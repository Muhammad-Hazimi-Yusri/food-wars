import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentHouseholdId } from "@/lib/inventory-export-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Token management for external inventory export access.
 *
 *   GET                      → { hasToken, lastFour } (safe summary)
 *   GET   ?reveal=1          → { token } (full plaintext, cookie-auth only)
 *   POST                     → { token } (generates and returns once)
 *   DELETE                   → { success: true }
 *
 * All methods require an active cookie session. Guests cannot manage tokens
 * because the guest household is shared across anonymous users.
 */

async function resolveSignedInHousehold(): Promise<
  | { householdId: string; isGuest: boolean }
  | { error: string; status: number }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated", status: 401 };
  }
  if (user.is_anonymous) {
    return { error: "Sign in to manage API tokens", status: 403 };
  }
  const householdId = await resolveCurrentHouseholdId(supabase);
  if (!householdId) {
    return { error: "No household found", status: 404 };
  }
  return { householdId, isGuest: false };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveSignedInHousehold();
    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const supabase = await createClient();
    const { data } = await supabase
      .from("household_ai_settings")
      .select("api_token")
      .eq("household_id", ctx.householdId)
      .maybeSingle();

    const token = data?.api_token ?? null;
    const reveal = new URL(request.url).searchParams.get("reveal") === "1";

    if (reveal) {
      return NextResponse.json({ token });
    }

    return NextResponse.json({
      hasToken: !!token,
      lastFour: token ? token.slice(-4) : null,
    });
  } catch (error) {
    console.error("GET /api/ai/api-token error:", error);
    return NextResponse.json(
      { error: "Failed to fetch API token" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const ctx = await resolveSignedInHousehold();
    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const token = "fw_" + randomBytes(32).toString("base64url");

    const supabase = await createClient();
    const { error } = await supabase
      .from("household_ai_settings")
      .upsert(
        {
          household_id: ctx.householdId,
          api_token: token,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "household_id" }
      );
    if (error) throw error;

    return NextResponse.json({ token });
  } catch (error) {
    console.error("POST /api/ai/api-token error:", error);
    return NextResponse.json(
      { error: "Failed to generate API token" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const ctx = await resolveSignedInHousehold();
    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("household_ai_settings")
      .update({ api_token: null, updated_at: new Date().toISOString() })
      .eq("household_id", ctx.householdId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/ai/api-token error:", error);
    return NextResponse.json(
      { error: "Failed to revoke API token" },
      { status: 500 }
    );
  }
}
