import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GUEST_HOUSEHOLD_ID } from "@/lib/constants";
import { fetchOllamaModels } from "@/lib/ai-utils";

export async function GET() {
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
      return NextResponse.json(
        { error: "No household found" },
        { status: 404 }
      );
    }

    const { data: settings } = await supabase
      .from("household_ai_settings")
      .select("ollama_url")
      .eq("household_id", householdId)
      .single();

    if (!settings?.ollama_url) {
      return NextResponse.json(
        { error: "No Ollama URL configured" },
        { status: 404 }
      );
    }

    const models = await fetchOllamaModels(settings.ollama_url);

    return NextResponse.json({
      models: models.map((m) => ({
        name: m.name,
        size: m.size,
        modified_at: m.modified_at,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch models";

    const is403 = message.includes("403");

    return NextResponse.json(
      {
        error: is403
          ? "Ollama returned 403 Forbidden. If using a tunnel (e.g. Cloudflare Tunnel), check that access policies allow unauthenticated requests."
          : message,
      },
      { status: 502 }
    );
  }
}
