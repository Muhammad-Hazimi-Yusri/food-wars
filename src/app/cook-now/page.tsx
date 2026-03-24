import { createClient } from "@/lib/supabase/server";
import { Noren } from "@/components/diner/Noren";
import { CookingPot } from "lucide-react";
import Link from "next/link";

export default async function CookNowPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-hayama">
        <Noren />
        <main className="max-w-5xl mx-auto p-4 sm:p-6">
          <p className="text-muted-foreground">
            Please sign in to use Cook Now.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hayama">
      <Noren />
      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="text-center py-16">
          <CookingPot className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">Tag your products to get started</p>
          <p className="text-sm text-gray-400 mt-1">
            Assign cooking roles to your inventory, then let Cook Now suggest
            what to make.
          </p>
          <Link
            href="/cook-now/setup"
            className="inline-flex items-center mt-4 px-4 py-2 rounded bg-soma text-white hover:bg-soma-dark text-sm"
          >
            Get Started
          </Link>
        </div>
      </main>
    </div>
  );
}
