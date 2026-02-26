import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error: authError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!authError) {
      // Check if user already has a household
      const { data: existing, error: existingError } = await supabase
        .from("households")
        .select("id")
        .limit(1)
        .single();

      // PGRST116 = "no rows returned", which is expected for new users.
      // Any other error means a real DB problem — abort to avoid creating
      // a duplicate household for an existing user.
      if (existingError && existingError.code !== "PGRST116") {
        console.error("Failed to query households:", existingError);
        return NextResponse.redirect(`${origin}/auth/error?reason=household`);
      }

      // Create household for new users
      if (!existing) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error: householdError } = await supabase.from("households").insert({
          name: `${user?.user_metadata?.name ?? "My"}'s Kitchen`,
          owner_id: user?.id,
        });

        if (householdError) {
          console.error("Failed to create household:", householdError);
          return NextResponse.redirect(`${origin}/auth/error?reason=household`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}