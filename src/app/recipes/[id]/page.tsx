import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChefHat, ArrowLeft, Pencil } from "lucide-react";
import { Noren } from "@/components/diner/Noren";
import { Button } from "@/components/ui/button";
import { getRecipePictureSignedUrl } from "@/lib/supabase/storage";
import type { Recipe } from "@/types/database";

type Props = {
  params: Promise<{ id: string }>;
};

async function getRecipe(id: string): Promise<Recipe | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();
  return (data as Recipe) ?? null;
}

export default async function RecipeDetailPage({ params }: Props) {
  const { id } = await params;
  const recipe = await getRecipe(id);

  if (!recipe) notFound();

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
          </div>
        </div>
      </main>
    </div>
  );
}
