import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

// Use service role to bypass RLS and call the function
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { secret } = await request.json();

    const adminSecret = process.env.ADMIN_SECRET ?? "";
    const secretsMatch =
      secret &&
      adminSecret.length > 0 &&
      secret.length === adminSecret.length &&
      timingSafeEqual(Buffer.from(secret), Buffer.from(adminSecret));

    if (!secretsMatch) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabaseAdmin.rpc("seed_guest_data");

    if (error) {
      console.error("Seed error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Guest data reset successfully",
    });
  } catch (error) {
    console.error("Reset guest data error:", error);
    return NextResponse.json(
      { error: "Failed to reset guest data" },
      { status: 500 }
    );
  }
}