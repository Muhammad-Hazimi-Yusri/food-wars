import { createClient } from "@/lib/supabase/server";
import { Noren } from "@/components/diner/Noren";
import { MealPlanClient } from "@/components/meal-plan/MealPlanClient";
import { computeRecipeFulfillment } from "@/lib/recipe-utils";
import type {
  MealPlanSection,
  MealPlanEntry,
  MealPlanEntryWithRelations,
  Recipe,
  Product,
  RecipeIngredientWithRelations,
} from "@/types/database";

type PageProps = {
  searchParams: Promise<{ week?: string; date?: string }>;
};

// ---------------------------------------------------------------------------
// Week helpers
// ---------------------------------------------------------------------------

function getISOMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function getWeekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => offsetDate(monday, i));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MealPlanPage({ searchParams }: PageProps) {
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
            Please sign in to view your meal plan.
          </p>
        </main>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const params = await searchParams;

  // Resolve week start — accept ?week= (Monday) or ?date= (derive Monday)
  let weekStart: string;
  if (params.week && DATE_RE.test(params.week)) {
    weekStart = getISOMonday(params.week);
  } else if (params.date && DATE_RE.test(params.date)) {
    weekStart = getISOMonday(params.date);
  } else {
    weekStart = getISOMonday(today);
  }

  const weekDays = getWeekDays(weekStart);
  const weekEnd = weekDays[6];

  // ---------------------------------------------------------------------------
  // Parallel data fetches — RLS filters by household automatically
  // ---------------------------------------------------------------------------
  const [sectionsResult, entriesResult, recipesResult, productsResult] =
    await Promise.all([
      supabase.from("meal_plan_sections").select("*").order("sort_order"),
      supabase
        .from("meal_plan")
        .select("*")
        .gte("day", weekStart)
        .lte("day", weekEnd)
        .order("sort_order"),
      supabase
        .from("recipes")
        .select("id, name, base_servings, picture_file_name")
        .eq("active", true)
        .order("name"),
      supabase
        .from("products")
        .select("id, name")
        .eq("active", true)
        .order("name"),
    ]);

  const sections = (sectionsResult.data ?? []) as MealPlanSection[];
  const entries = (entriesResult.data ?? []) as MealPlanEntry[];
  const recipes = (recipesResult.data ?? []) as Pick<
    Recipe,
    "id" | "name" | "base_servings" | "picture_file_name"
  >[];
  const products = (productsResult.data ?? []) as Pick<Product, "id" | "name">[];

  // ---------------------------------------------------------------------------
  // Fulfillment computation — fetch ingredients + stock for week's recipes
  // ---------------------------------------------------------------------------
  const weekRecipeIds = [
    ...new Set(
      entries.filter((e) => e.recipe_id != null).map((e) => e.recipe_id!)
    ),
  ];

  const fulfillmentByRecipeId: Record<string, boolean> = {};
  const kcalPerServingByRecipe: Record<string, number> = {};

  if (weekRecipeIds.length > 0) {
    const [ingredientsResult, stockResult, nutritionResult] = await Promise.all([
      supabase
        .from("recipe_ingredients")
        .select(
          "id, recipe_id, product_id, amount, qu_id, not_check_stock_fulfillment, variable_amount, sort_order, ingredient_group, note, " +
            "product:products(id, name, qu_id_stock, not_check_stock_fulfillment_for_recipes), " +
            "qu:quantity_units(id, name, name_plural)"
        )
        .in("recipe_id", weekRecipeIds),
      supabase.from("stock_entries").select("product_id, amount"),
      supabase.from("product_nutritions").select("product_id, energy_kcal"),
    ]);

    const allIngredients =
      (ingredientsResult.data ?? []) as unknown as RecipeIngredientWithRelations[];

    // Build stock totals map
    const stockByProduct = new Map<string, number>();
    for (const entry of stockResult.data ?? []) {
      const cur = stockByProduct.get(entry.product_id) ?? 0;
      stockByProduct.set(entry.product_id, cur + (entry.amount ?? 0));
    }

    // Compute canMake per recipe using base_servings as the target
    const recipesMap = new Map(recipes.map((r) => [r.id, r]));
    for (const recipeId of weekRecipeIds) {
      const ings = allIngredients.filter((i) => i.recipe_id === recipeId);
      const recipe = recipesMap.get(recipeId);
      const base = recipe?.base_servings ?? 1;
      const result = computeRecipeFulfillment(ings, stockByProduct, base, base);
      fulfillmentByRecipeId[recipeId] = result.canMake;
    }

    // Build kcal-per-serving map for calorie display
    const kcalByProduct = new Map<string, number>();
    for (const n of nutritionResult.data ?? []) {
      if (n.energy_kcal != null) kcalByProduct.set(n.product_id, n.energy_kcal);
    }
    for (const recipeId of weekRecipeIds) {
      const ings = allIngredients.filter((i) => i.recipe_id === recipeId);
      const base = recipesMap.get(recipeId)?.base_servings ?? 1;
      let totalKcal = 0;
      for (const ing of ings) {
        if (!ing.product_id || ing.variable_amount) continue;
        totalKcal += (ing.amount ?? 0) * ((kcalByProduct.get(ing.product_id) ?? 0) / 100);
      }
      kcalPerServingByRecipe[recipeId] = base > 0 ? totalKcal / base : 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Assemble entries with relations (manual map join)
  // ---------------------------------------------------------------------------
  const recipesMap = new Map(recipes.map((r) => [r.id, r]));
  const productsMap = new Map(products.map((p) => [p.id, p]));
  const sectionsMap = new Map(sections.map((s) => [s.id, s]));

  const entriesWithRelations: MealPlanEntryWithRelations[] = entries.map(
    (entry) => ({
      ...entry,
      section: entry.section_id
        ? (sectionsMap.get(entry.section_id) ?? null)
        : null,
      recipe: entry.recipe_id
        ? (recipesMap.get(entry.recipe_id) ?? null)
        : null,
      product: entry.product_id
        ? (productsMap.get(entry.product_id) ?? null)
        : null,
      product_qu: null,
    })
  );

  return (
    <div className="min-h-screen bg-hayama">
      <Noren />
      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        <MealPlanClient
          weekStart={weekStart}
          weekDays={weekDays}
          today={today}
          sections={sections}
          entries={entriesWithRelations}
          recipes={recipes}
          products={products}
          fulfillmentByRecipeId={fulfillmentByRecipeId}
          kcalPerServingByRecipe={kcalPerServingByRecipe}
        />
      </main>
    </div>
  );
}
