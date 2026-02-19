import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchOllamaModels } from "@/lib/ai-utils";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { ollama_url } = await request.json();

    if (!ollama_url) {
      return NextResponse.json(
        { error: "ollama_url is required" },
        { status: 400 }
      );
    }

    try {
      new URL(ollama_url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    const models = await fetchOllamaModels(ollama_url);

    return NextResponse.json({
      success: true,
      models: models.map((m) => ({
        name: m.name,
        size: m.size,
        modified_at: m.modified_at,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Connection failed";

    // Distinguish network errors and auth errors from other failures
    const isNetworkError =
      message.includes("fetch failed") ||
      message.includes("ECONNREFUSED") ||
      message.includes("abort") ||
      message.includes("timeout");

    const is403 = message.includes("403");

    return NextResponse.json(
      {
        error: isNetworkError
          ? "Could not reach Ollama. Check the URL and ensure Ollama is running."
          : is403
            ? "Ollama returned 403 Forbidden. If using a tunnel (e.g. Cloudflare Tunnel), check that access policies allow unauthenticated requests."
            : `Ollama error: ${message}`,
      },
      { status: 502 }
    );
  }
}
