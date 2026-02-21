import { createClient } from "@/lib/supabase/server";
import { Noren } from "@/components/diner/Noren";
import { RecipesListClient } from "@/components/recipes/RecipesListClient";
import { getRecipePictureSignedUrl } from "@/lib/supabase/storage";
import type { Recipe } from "@/types/database";

type RecipeWithUrl = Recipe & { pictureUrl: string | null };

async function getRecipes(): Promise<RecipeWithUrl[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("recipes")
    .select("*")
    .order("name");

  const recipes = (data as Recipe[]) ?? [];

  const withUrls = await Promise.all(
    recipes.map(async (recipe) => ({
      ...recipe,
      pictureUrl: await getRecipePictureSignedUrl(recipe.picture_file_name),
    }))
  );

  return withUrls;
}

export default async function RecipesPage() {
  const recipes = await getRecipes();

  return (
    <div className="min-h-screen bg-hayama">
      <Noren />
      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        <RecipesListClient recipes={recipes} />
      </main>
    </div>
  );
}
