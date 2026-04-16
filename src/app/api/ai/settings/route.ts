import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GUEST_HOUSEHOLD_ID } from "@/lib/constants";

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

    const { data } = await supabase
      .from("household_ai_settings")
      .select("*")
      .eq("household_id", householdId)
      .single();

    return NextResponse.json({ settings: data });
  } catch (error) {
    console.error("GET /api/ai/settings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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

    const {
      ollama_url,
      text_model,
      vision_model,
      notify_days_before,
      notify_browser,
      notify_bell,
    } = await request.json();

    // Basic URL validation
    if (ollama_url) {
      try {
        new URL(ollama_url);
      } catch {
        return NextResponse.json(
          { error: "Invalid Ollama URL format" },
          { status: 400 }
        );
      }
    }

    // Validate notification preferences if provided
    if (notify_days_before !== undefined) {
      if (
        typeof notify_days_before !== "number" ||
        !Number.isInteger(notify_days_before) ||
        notify_days_before < 0 ||
        notify_days_before > 30
      ) {
        return NextResponse.json(
          { error: "notify_days_before must be an integer between 0 and 30" },
          { status: 400 }
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upsertPayload: Record<string, any> = {
      household_id: householdId,
      ollama_url: ollama_url || null,
      text_model: text_model || null,
      vision_model: vision_model || null,
      updated_at: new Date().toISOString(),
    };

    if (notify_days_before !== undefined) upsertPayload.notify_days_before = notify_days_before;
    if (notify_browser !== undefined) upsertPayload.notify_browser = !!notify_browser;
    if (notify_bell !== undefined) upsertPayload.notify_bell = !!notify_bell;

    const { data, error } = await supabase
      .from("household_ai_settings")
      .upsert(upsertPayload, { onConflict: "household_id" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ settings: data });
  } catch (error) {
    console.error("PUT /api/ai/settings error:", error);
    return NextResponse.json(
      { error: "Failed to save AI settings" },
      { status: 500 }
    );
  }
}
