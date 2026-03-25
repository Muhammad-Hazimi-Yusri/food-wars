import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChefHat, CheckCircle, XCircle } from "lucide-react";
import { computeRecipeFulfillment } from "@/lib/recipe-utils";
import { generateQuickCombos, type ComboSuggestion } from "@/lib/cook-now-utils";
import type { RecipeIngredientWithRelations } from "@/types/database";

/**
 * Server component — shows tonight's dinner recipes with fulfillment badges,
 * quick combo suggestions from in-stock tagged products, and a link to Cook Now.
 * Renders nothing only when the user is not authenticated.
 */
export async function TodaysDinnerCard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date().toISOString().split("T")[0];

  // ------------------------------------------------------------------
  // Dinner entries
  // ------------------------------------------------------------------

  const { data: sections } = await supabase
    .from("meal_plan_sections")
    .select("id, name");
  const dinnerSection = sections?.find(
    (s) => s.name.toLowerCase() === "dinner"
  );

  let recipeEntries: { id: string; recipe_id: string | null; recipe_servings: number | null }[] = [];

  if (dinnerSection) {
    const { data: entries } = await supabase
      .from("meal_plan")
      .select("id, type, recipe_id, recipe_servings")
      .eq("day", today)
      .eq("section_id", dinnerSection.id)
      .eq("type", "recipe")
      .order("sort_order");
    recipeEntries = (entries ?? []).filter((e) => e.recipe_id != null);
  }

  const recipeIds = recipeEntries.map((e) => e.recipe_id!);

  // ------------------------------------------------------------------
  // Parallel data: recipes + ingredients + stock + tagged products
  // ------------------------------------------------------------------

  const [recipesResult, ingredientsResult, stockResult, taggedResult] =
    await Promise.all([
      recipeIds.length > 0
        ? supabase
            .from("recipes")
            .select("id, name, base_servings")
            .in("id", recipeIds)
        : Promise.resolve({ data: [] as { id: string; name: string; base_servings: number | null }[] }),
      recipeIds.length > 0
        ? supabase
            .from("recipe_ingredients")
            .select(
              "id, recipe_id, product_id, amount, qu_id, not_check_stock_fulfillment, variable_amount, sort_order, ingredient_group, note, " +
                "product:products(id, name, qu_id_stock, not_check_stock_fulfillment_for_recipes), " +
                "qu:quantity_units(id, name, name_plural)"
            )
            .in("recipe_id", recipeIds)
        : Promise.resolve({ data: [] as unknown[] }),
      supabase.from("stock_entries").select("product_id, amount, best_before_date"),
      supabase
        .from("stock_entries")
        .select(
          `product_id, amount, best_before_date,
           product:products(id, name, cooking_role)`
        )
        .gt("amount", 0)
        .not("product.cooking_role", "is", null),
    ]);

  // ------------------------------------------------------------------
  // Recipe fulfillment
  // ------------------------------------------------------------------

  const stockByProduct = new Map<string, number>();
  for (const entry of stockResult.data ?? []) {
    const cur = stockByProduct.get(entry.product_id) ?? 0;
    stockByProduct.set(entry.product_id, cur + (entry.amount ?? 0));
  }

  const recipesMap = new Map(
    ((recipesResult.data as { id: string; name: string; base_servings: number | null }[]) ?? []).map((r) => [r.id, r])
  );
  const allIngredients =
    ((ingredientsResult.data as unknown[]) ?? []) as unknown as RecipeIngredientWithRelations[];

  // ------------------------------------------------------------------
  // Quick combos
  // ------------------------------------------------------------------

  // Aggregate tagged stock entries by product (earliest expiry per product)
  const taggedMap = new Map<
    string,
    { id: string; name: string; cooking_role: string; earliest_expiry: string | null }
  >();

  for (const entry of taggedResult.data ?? []) {
    const p = entry.product as unknown as {
      id: string;
      name: string;
      cooking_role: string | null;
    } | null;
    if (!p || !p.cooking_role) continue;

    const existing = taggedMap.get(p.id);
    if (existing) {
      if (
        entry.best_before_date &&
        (!existing.earliest_expiry || entry.best_before_date < existing.earliest_expiry)
      ) {
        existing.earliest_expiry = entry.best_before_date;
      }
    } else {
      taggedMap.set(p.id, {
        id: p.id,
        name: p.name,
        cooking_role: p.cooking_role,
        earliest_expiry: entry.best_before_date ?? null,
      });
    }
  }

  const combos = generateQuickCombos(Array.from(taggedMap.values()));
  const hasTaggedProducts = taggedMap.size > 0;
  const hasDinner = recipeEntries.length > 0;

  // Nothing to show at all — hide the card
  if (!hasDinner && combos.length === 0 && !hasTaggedProducts) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <ChefHat className="h-4 w-4 text-soma" />
          <span className="text-sm font-semibold text-megumi">
            What&apos;s for dinner?
          </span>
        </div>
        {hasDinner && (
          <Link
            href={`/meal-plan?date=${today}`}
            className="text-xs text-muted-foreground hover:text-soma transition-colors"
          >
            See full plan →
          </Link>
        )}
      </div>

      {/* Tonight's dinner recipes */}
      {hasDinner && (
        <div className="space-y-1 mb-3">
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
      )}

      {/* Quick combos */}
      {combos.length > 0 ? (
        <div className={hasDinner ? "border-t border-border pt-3" : ""}>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Quick combos
          </p>
          <div className="space-y-1.5">
            {combos.map((combo, i) => (
              <ComboPills key={i} combo={combo} />
            ))}
          </div>
        </div>
      ) : hasTaggedProducts ? null : (
        <div className={hasDinner ? "border-t border-border pt-3" : ""}>
          <Link
            href="/cook-now/setup"
            className="text-xs text-muted-foreground hover:text-soma transition-colors"
          >
            Tag products to get suggestions →
          </Link>
        </div>
      )}

      {/* Footer link */}
      <div className="mt-3 pt-2 border-t border-border">
        <Link
          href="/cook-now"
          className="text-xs text-muted-foreground hover:text-soma transition-colors"
        >
          Open Cook Now →
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function ComboPills({ combo }: { combo: ComboSuggestion }) {
  const parts = [combo.protein.name, combo.seasoning.name];
  if (combo.base) parts.push(combo.base.name);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-xs">🔥</span>
      {parts.map((name, i) => (
        <span key={name} className="flex items-center gap-1">
          {i > 0 && <span className="text-xs text-muted-foreground">+</span>}
          <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-hayama text-megumi">
            {name}
          </span>
        </span>
      ))}
    </div>
  );
}
