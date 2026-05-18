import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyFoodWarsToken } from "@/lib/mcp/auth";
import { registerTools } from "@/lib/mcp/tools";
import { preflightResponse, withCors } from "@/lib/mcp/cors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const baseHandler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  {
    serverInfo: { name: "food-wars", version: "1.0.0" },
  },
  {
    basePath: "/api",
    maxDuration: 60,
    disableSse: true,
  },
);

const authedHandler = withMcpAuth(baseHandler, verifyFoodWarsToken, {
  required: true,
});

async function handle(request: Request): Promise<Response> {
  const response = await authedHandler(request);
  return withCors(request, response);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handle(request);
}
