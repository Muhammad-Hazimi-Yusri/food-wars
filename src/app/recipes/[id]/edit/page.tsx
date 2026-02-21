import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Noren } from "@/components/diner/Noren";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import type { Recipe } from "@/types/database";

type Props = {
  params: Promise<{ id: string }>;
};

async function getRecipe(id: string): Promise<Recipe | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();
  return (data as Recipe) ?? null;
}

export default async function EditRecipePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const recipe = await getRecipe(id);
  if (!recipe) notFound();

  return (
    <div className="min-h-screen bg-hayama">
      <Noren />
      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-megumi mb-6">Edit Recipe</h1>
        <RecipeForm recipe={recipe} />
      </main>
    </div>
  );
}
