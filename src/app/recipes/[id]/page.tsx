import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChefHat, ArrowLeft, Pencil } from "lucide-react";
import { Noren } from "@/components/diner/Noren";
import { Button } from "@/components/ui/button";
import { getRecipePictureSignedUrl } from "@/lib/supabase/storage";
import { RecipeDetailClient } from "@/components/recipes/RecipeDetailClient";
import type {
  Recipe,
  RecipeIngredientWithRelations,
  RecipeNestingWithRelations,
  Product,
  QuantityUnit,
  ShoppingList,
} from "@/types/database";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function RecipeDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch everything in one round trip
  const [
    recipeResult,
    productsResult,
    quantityUnitsResult,
    nestingsResult,
    allRecipesResult,
    allIngredientsResult,
    stockResult,
    listsResult,
  ] = await Promise.all([
    supabase.from("recipes").select("*").eq("id", id).single(),
    supabase
      .from("products")
      .select("id, name, qu_id_stock, not_check_stock_fulfillment_for_recipes")
      .eq("active", true)
      .order("name"),
    supabase
      .from("quantity_units")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("recipe_nestings")
      .select(
        "*, included_recipe:recipes!includes_recipe_id(id, name, base_servings)"
      )
      .eq("recipe_id", id),
    supabase
      .from("recipes")
      .select("id, name, base_servings")
      .order("name"),
    supabase
      .from("recipe_ingredients")
      .select(
        "*, product:products(id, name, qu_id_stock, not_check_stock_fulfillment_for_recipes), qu:quantity_units(id, name, name_plural)"
      ),
    supabase.from("stock_entries").select("product_id, amount"),
    supabase.from("shopping_lists").select("*").order("name"),
  ]);

  if (!recipeResult.data) notFound();

  const recipe = recipeResult.data as Recipe;
  const products = (productsResult.data ?? []) as Product[];
  const quantityUnits = (quantityUnitsResult.data ?? []) as QuantityUnit[];
  const nestings = (nestingsResult.data ?? []) as RecipeNestingWithRelations[];
  const allRecipes = (allRecipesResult.data ?? []) as Pick<
    Recipe,
    "id" | "name" | "base_servings"
  >[];
  const shoppingLists = (listsResult.data ?? []) as ShoppingList[];

  // Build per-recipe ingredient map from all household ingredients
  const allRawIngredients = (
    allIngredientsResult.data ?? []
  ) as RecipeIngredientWithRelations[];

  const allIngredientsByRecipe: Record<string, RecipeIngredientWithRelations[]> =
    {};
  for (const ing of allRawIngredients) {
    if (!allIngredientsByRecipe[ing.recipe_id]) {
      allIngredientsByRecipe[ing.recipe_id] = [];
    }
    allIngredientsByRecipe[ing.recipe_id].push(ing);
  }

  // Own ingredients for this recipe (already ordered by sort_order from DB)
  const ownIngredients = (allIngredientsByRecipe[id] ?? []).sort(
    (a, b) => a.sort_order - b.sort_order
  );

  // Build stockByProduct: sum amounts per product_id
  const stockByProduct: Record<string, number> = {};
  for (const row of stockResult.data ?? []) {
    const entry = row as { product_id: string; amount: number };
    stockByProduct[entry.product_id] =
      (stockByProduct[entry.product_id] ?? 0) + entry.amount;
  }

  // Resolve produces product name
  const initialProducesProductName = recipe.product_id
    ? (products.find((p) => p.id === recipe.product_id)?.name ?? null)
    : null;

  const pictureUrl = await getRecipePictureSignedUrl(recipe.picture_file_name);

  return (
    <div className="min-h-screen bg-hayama">
      <Noren />
      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Back + actions */}
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href="/recipes">
              <ArrowLeft className="h-4 w-4" />
              Recipes
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={`/recipes/${id}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        </div>

        {/* Recipe card */}
        <div className="bg-white rounded-lg border overflow-hidden">
          {/* Picture */}
          {pictureUrl ? (
            <div className="relative h-48 sm:h-64 bg-hayama">
              <Image
                src={pictureUrl}
                alt={recipe.name}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="h-32 bg-hayama flex items-center justify-center">
              <ChefHat className="h-10 w-10 text-hayama-dark" />
            </div>
          )}

          {/* Content */}
          <div className="p-4 sm:p-6 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold text-megumi">{recipe.name}</h1>
              <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0 mt-1">
                {recipe.base_servings === 1
                  ? "1 serving"
                  : `${recipe.base_servings} servings`}
              </span>
            </div>

            {recipe.description && (
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {recipe.description}
              </p>
            )}

            {recipe.instructions && (
              <div className="border-t pt-3 mt-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Instructions
                </p>
                <div className="prose prose-sm max-w-none text-gray-700">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {recipe.instructions}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Serving scaler + fulfillment + ingredient list + nestings + produces */}
        <RecipeDetailClient
          recipe={recipe}
          initialIngredients={ownIngredients}
          products={products}
          quantityUnits={quantityUnits}
          stockByProduct={stockByProduct}
          shoppingLists={shoppingLists}
          nestings={nestings}
          allRecipes={allRecipes}
          allIngredientsByRecipe={allIngredientsByRecipe}
          initialProducesProductName={initialProducesProductName}
        />
      </main>
    </div>
  );
}
