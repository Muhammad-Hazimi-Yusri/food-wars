import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GUEST_HOUSEHOLD_ID } from "@/lib/constants";
import { getAiSettings } from "@/lib/ai-utils";
import { parseReceiptCore, type ParseReceiptMode } from "@/lib/ai-parse-receipt-core";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const householdId = user.is_anonymous
      ? GUEST_HOUSEHOLD_ID
      : (
          await supabase
            .from("households")
            .select("id")
            .eq("owner_id", user.id)
            .single()
        ).data?.id;

    if (!householdId) {
      return NextResponse.json({ error: "No household found" }, { status: 404 });
    }

    const aiSettings = await getAiSettings(householdId);

    const body = await request.json();
    const { text, mode, imageBase64, currentItems } = body as {
      text?: string;
      mode: ParseReceiptMode;
      imageBase64?: string;
      currentItems?: unknown[];
    };

    const result = await parseReceiptCore(supabase, householdId, aiSettings, {
      mode,
      text,
      imageBase64,
      currentItems,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      items: result.items,
      ...(result.rawResponse ? { rawResponse: result.rawResponse } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Parse failed";

    const isNetworkError =
      message.includes("fetch failed") ||
      message.includes("ECONNREFUSED") ||
      message.includes("abort") ||
      message.includes("timeout");

    const is403 = message.includes("403");

    return NextResponse.json(
      {
        error: isNetworkError
          ? "Could not reach Ollama. Check Settings and ensure Ollama is running."
          : is403
            ? "Ollama returned 403 Forbidden. If using a tunnel (e.g. Cloudflare Tunnel), check that access policies allow unauthenticated requests."
            : `AI parse error: ${message}`,
      },
      { status: 502 }
    );
  }
}
