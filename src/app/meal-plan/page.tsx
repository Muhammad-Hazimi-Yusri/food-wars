import { createClient } from "@/lib/supabase/server";
import { Noren } from "@/components/diner/Noren";
import { MealPlanClient } from "@/components/meal-plan/MealPlanClient";
import type {
  MealPlanSection,
  MealPlanEntry,
  MealPlanEntryWithRelations,
  Recipe,
  Product,
} from "@/types/database";

type PageProps = {
  searchParams: Promise<{ date?: string }>;
};

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

  // Resolve date param — default to today (timezone-safe)
  const params = await searchParams;
  const today = new Date().toISOString().split("T")[0];
  const date =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : today;

  // Parallel fetches — RLS filters by household automatically
  const [sectionsResult, entriesResult, recipesResult, productsResult] =
    await Promise.all([
      supabase
        .from("meal_plan_sections")
        .select("*")
        .order("sort_order"),
      supabase
        .from("meal_plan")
        .select("*")
        .eq("day", date)
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

  // Assemble entries with relations (manual join — avoids complex FK hints)
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
      <main className="max-w-2xl mx-auto p-4 sm:p-6">
        <MealPlanClient
          date={date}
          sections={sections}
          entries={entriesWithRelations}
          recipes={recipes}
          products={products}
        />
      </main>
    </div>
  );
}
