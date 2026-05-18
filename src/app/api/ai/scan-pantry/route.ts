import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GUEST_HOUSEHOLD_ID } from "@/lib/constants";
import { getAiSettings } from "@/lib/ai-utils";
import { scanPantryCore } from "@/lib/ai-scan-pantry-core";

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
    const { imageBase64 } = body as { imageBase64?: string };

    const result = await scanPantryCore(supabase, householdId, aiSettings, {
      imageBase64: imageBase64 ?? "",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      items: result.items,
      ...(result.rawResponse ? { rawResponse: result.rawResponse } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pantry scan failed";

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
            : `AI scan error: ${message}`,
      },
      { status: 502 }
    );
  }
}
