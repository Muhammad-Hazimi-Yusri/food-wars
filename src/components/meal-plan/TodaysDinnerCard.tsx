import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChefHat, CheckCircle, XCircle } from "lucide-react";
import { computeRecipeFulfillment } from "@/lib/recipe-utils";
import type { RecipeIngredientWithRelations } from "@/types/database";

/**
 * Server component — shows today's Dinner section meals with fulfillment badges.
 * Renders nothing if the user has no dinner planned today.
 */
export async function TodaysDinnerCard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date().toISOString().split("T")[0];

  // Find the "Dinner" section (case-insensitive match)
  const { data: sections } = await supabase
    .from("meal_plan_sections")
    .select("id, name");
  const dinnerSection = sections?.find(
    (s) => s.name.toLowerCase() === "dinner"
  );
  if (!dinnerSection) return null;

  // Today's recipe entries in dinner section
  const { data: entries } = await supabase
    .from("meal_plan")
    .select("id, type, recipe_id, recipe_servings")
    .eq("day", today)
    .eq("section_id", dinnerSection.id)
    .eq("type", "recipe")
    .order("sort_order");

  const recipeEntries = (entries ?? []).filter((e) => e.recipe_id != null);
  if (recipeEntries.length === 0) return null;

  const recipeIds = recipeEntries.map((e) => e.recipe_id!);

  // Parallel: recipe names + base servings, ingredients, stock
  const [recipesResult, ingredientsResult, stockResult] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, name, base_servings")
      .in("id", recipeIds),
    supabase
      .from("recipe_ingredients")
      .select(
        "id, recipe_id, product_id, amount, qu_id, not_check_stock_fulfillment, variable_amount, sort_order, ingredient_group, note, " +
          "product:products(id, name, qu_id_stock, not_check_stock_fulfillment_for_recipes), " +
          "qu:quantity_units(id, name, name_plural)"
      )
      .in("recipe_id", recipeIds),
    supabase.from("stock_entries").select("product_id, amount"),
  ]);

  const stockByProduct = new Map<string, number>();
  for (const entry of stockResult.data ?? []) {
    const cur = stockByProduct.get(entry.product_id) ?? 0;
    stockByProduct.set(entry.product_id, cur + (entry.amount ?? 0));
  }

  const recipesMap = new Map(
    (recipesResult.data ?? []).map((r) => [r.id, r])
  );
  const allIngredients =
    (ingredientsResult.data ?? []) as unknown as RecipeIngredientWithRelations[];

  return (
    <div className="rounded-lg border border-border bg-card p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <ChefHat className="h-4 w-4 text-soma" />
          <span className="text-sm font-semibold text-megumi">
            Tonight&apos;s dinner
          </span>
        </div>
        <Link
          href={`/meal-plan?date=${today}`}
          className="text-xs text-muted-foreground hover:text-soma transition-colors"
        >
          See full plan →
        </Link>
      </div>

      <div className="space-y-1">
        {recipeEntries.map((entry) => {
          const recipe = recipesMap.get(entry.recipe_id!);
          if (!recipe) return null;

          const ings = allIngredients.filter(
            (i) => i.recipe_id === entry.recipe_id
          );
          const base = recipe.base_servings ?? 1;
          const servings = entry.recipe_servings ?? base;
          const { canMake } = computeRecipeFulfillment(
            ings,
            stockByProduct,
            servings,
            base
          );

          return (
            <div key={entry.id} className="flex items-center gap-2 text-sm">
              {canMake ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
              )}
              <span className="text-foreground">{recipe.name}</span>
              {servings !== base && (
                <span className="text-xs text-muted-foreground">
                  ×{servings}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
