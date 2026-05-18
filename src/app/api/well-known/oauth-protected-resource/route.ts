import { NextResponse } from "next/server";
import { buildProtectedResourceMetadata, getPublicOrigin } from "@/lib/mcp/oauth/metadata";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const origin = getPublicOrigin(request);
  return NextResponse.json(buildProtectedResourceMetadata(origin), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
