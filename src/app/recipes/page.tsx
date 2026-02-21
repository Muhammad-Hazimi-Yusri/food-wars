import { createClient } from "@/lib/supabase/server";
import { Noren } from "@/components/diner/Noren";
import { ChefHat } from "lucide-react";
import type { Recipe } from "@/types/database";

async function getRecipes(): Promise<Recipe[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("recipes")
    .select("*")
    .order("name");

  return (data as Recipe[]) ?? [];
}

export default async function RecipesPage() {
  const recipes = await getRecipes();

  return (
    <div className="min-h-screen bg-hayama">
      <Noren />
      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-megumi mb-4">Recipes</h1>

        {recipes.length === 0 ? (
          <div className="text-center py-16">
            <ChefHat className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No recipes yet.</p>
            <p className="text-sm text-gray-400 mt-1">
              Recipes will appear here once you create them.
            </p>
          </div>
        ) : (
          <div className="text-gray-500">
            {recipes.length} recipe{recipes.length !== 1 ? "s" : ""}
          </div>
        )}
      </main>
    </div>
  );
}
