import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  buildInventoryItems,
  formatInventoryPreamble,
  resolveCurrentHouseholdId,
  type AggregatedItem,
} from "@/lib/inventory-export-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Extract a bearer token from either the Authorization header or
 * ?token= query param. Returns null if neither is present.
 */
function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  const urlToken = new URL(request.url).searchParams.get("token");
  return urlToken?.trim() || null;
}

/**
 * Filter aggregated items to those expiring within `days` days.
 * Items without an expiry date are excluded.
 */
function filterByExpiring(items: AggregatedItem[], days: number): AggregatedItem[] {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() + days);
  const cutoffIso = cutoff.toISOString().split("T")[0];
  return items.filter((i) => i.exp && i.exp <= cutoffIso);
}

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request);

    if (token) {
      // Token path — use service-role client so we bypass cookie RLS
      let service;
      try {
        service = createServiceClient();
      } catch (e) {
        console.error("[api/inventory/export] service client error:", e);
        return NextResponse.json(
          { error: "Server not configured for token authentication" },
          { status: 500 }
        );
      }

      const { data: row } = await service
        .from("household_ai_settings")
        .select("household_id")
        .eq("api_token", token)
        .maybeSingle();

      const tokenHouseholdId: string | null = row?.household_id ?? null;
      if (!tokenHouseholdId) {
        return NextResponse.json({ error: "Invalid API token" }, { status: 401 });
      }

      const tokenResult = await buildInventoryItems(service, tokenHouseholdId);
      if (tokenResult.error) {
        return NextResponse.json({ error: tokenResult.error }, { status: 500 });
      }

      return respondWithItems(request, tokenResult.items, tokenResult.today);
    }

    // Cookie session fallback
    const supabase = await createClient();
    const sessionHouseholdId = await resolveCurrentHouseholdId(supabase);
    if (!sessionHouseholdId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { items, today, error } = await buildInventoryItems(supabase, sessionHouseholdId);
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return respondWithItems(request, items, today);
  } catch (error) {
    console.error("[api/inventory/export] error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

function respondWithItems(
  request: NextRequest,
  items: AggregatedItem[],
  today: string
): NextResponse {
  const params = new URL(request.url).searchParams;

  // Optional ?expiring=N filter
  const expiringRaw = params.get("expiring");
  let filtered = items;
  if (expiringRaw) {
    const days = parseInt(expiringRaw, 10);
    if (!Number.isNaN(days) && days >= 0) {
      filtered = filterByExpiring(items, days);
    }
  }

  // Optional ?preamble=1 → text/plain with intro line
  if (params.get("preamble") === "1") {
    return new NextResponse(formatInventoryPreamble(filtered, today), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // Default: raw compact JSON array (minimum tokens)
  return new NextResponse(JSON.stringify(filtered), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
