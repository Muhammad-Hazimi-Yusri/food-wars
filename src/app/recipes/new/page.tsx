import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Noren } from "@/components/diner/Noren";
import { RecipeForm } from "@/components/recipes/RecipeForm";

export default async function NewRecipePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-hayama">
      <Noren />
      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-megumi mb-6">New Recipe</h1>
        <RecipeForm />
      </main>
    </div>
  );
}
