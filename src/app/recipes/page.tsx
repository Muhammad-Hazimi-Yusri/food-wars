import { createClient } from "@/lib/supabase/server";
import { Noren } from "@/components/diner/Noren";
import { RecipesListClient } from "@/components/recipes/RecipesListClient";
import { getRecipePictureSignedUrl } from "@/lib/supabase/storage";
import { computeDueScore } from "@/lib/recipe-utils";
import type { Recipe } from "@/types/database";

type RecipeWithUrl = Recipe & { pictureUrl: string | null };

export default async function RecipesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="min-h-screen bg-hayama">
        <Noren />
        <main className="max-w-5xl mx-auto p-4 sm:p-6">
          <p className="text-muted-foreground">Please sign in to view recipes.</p>
        </main>
      </div>
    );
  }

  const [recipesResult, ingredientsResult, stockResult] = await Promise.all([
    supabase.from("recipes").select("*").order("name"),
    supabase.from("recipe_ingredients").select("recipe_id, product_id"),
    supabase.from("stock_entries").select("product_id, best_before_date"),
  ]);

  const recipes = (recipesResult.data as Recipe[]) ?? [];
  const allIngredients = (ingredientsResult.data ?? []) as {
    recipe_id: string;
    product_id: string | null;
  }[];
  const stockEntries = (stockResult.data ?? []) as {
    product_id: string;
    best_before_date: string | null;
  }[];

  // Group ingredients by recipe
  const ingredientsByRecipe = new Map<
    string,
    { product_id: string | null }[]
  >();
  for (const ing of allIngredients) {
    if (!ingredientsByRecipe.has(ing.recipe_id)) {
      ingredientsByRecipe.set(ing.recipe_id, []);
    }
    ingredientsByRecipe.get(ing.recipe_id)!.push(ing);
  }

  const today = new Date().toISOString().split("T")[0];
  const dueScoreByRecipe: Record<string, number> = {};
  for (const recipe of recipes) {
    const ings = ingredientsByRecipe.get(recipe.id) ?? [];
    dueScoreByRecipe[recipe.id] = computeDueScore(ings, stockEntries, today);
  }

  const withUrls = await Promise.all(
    recipes.map(async (recipe) => ({
      ...recipe,
      pictureUrl: await getRecipePictureSignedUrl(recipe.picture_file_name),
    }))
  );

  return (
    <div className="min-h-screen bg-hayama">
      <Noren />
      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        <RecipesListClient
          recipes={withUrls as RecipeWithUrl[]}
          dueScoreByRecipe={dueScoreByRecipe}
        />
      </main>
    </div>
  );
}
