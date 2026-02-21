"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Plus, Search, ChefHat, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteRecipe, undoDeleteRecipe } from "@/lib/recipe-actions";
import type { Recipe } from "@/types/database";

type RecipeWithUrl = Recipe & { pictureUrl: string | null };

type Props = {
  recipes: RecipeWithUrl[];
};

export function RecipesListClient({ recipes: initialRecipes }: Props) {
  const router = useRouter();
  const [recipes, setRecipes] = useState(initialRecipes);
  const [search, setSearch] = useState("");

  const filtered = recipes.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q)
    );
  });

  const handleDelete = async (recipe: Recipe) => {
    // Optimistic remove
    setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));

    const result = await deleteRecipe(recipe.id);
    if (!result.success) {
      setRecipes((prev) => [...prev, recipe as RecipeWithUrl]);
      toast.error("Failed to delete recipe.");
      return;
    }

    const snapshot = result.snapshot!;

    toast("Recipe deleted.", {
      duration: 8000,
      action: {
        label: "Undo",
        onClick: async () => {
          const undo = await undoDeleteRecipe(snapshot);
          if (undo.success) {
            router.refresh();
          } else {
            toast.error("Failed to undo.");
          }
        },
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-megumi">Recipes</h1>
        <Button asChild className="bg-soma text-white hover:bg-soma-dark">
          <Link href="/recipes/new">
            <Plus className="h-4 w-4 mr-1" />
            Add Recipe
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <ChefHat className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          {search ? (
            <p className="text-gray-500">No recipes match &ldquo;{search}&rdquo;.</p>
          ) : (
            <>
              <p className="text-gray-500">No recipes yet.</p>
              <p className="text-sm text-gray-400 mt-1">
                Create your first recipe to get started.
              </p>
              <Button
                asChild
                className="mt-4 bg-soma text-white hover:bg-soma-dark"
              >
                <Link href="/recipes/new">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Recipe
                </Link>
              </Button>
            </>
          )}
        </div>
      )}

      {/* Recipe grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeCard({
  recipe,
  onDelete,
}: {
  recipe: RecipeWithUrl;
  onDelete: (r: Recipe) => void;
}) {
  const descriptionExcerpt =
    recipe.description && recipe.description.length > 90
      ? recipe.description.slice(0, 87) + "..."
      : recipe.description;

  return (
    <div className="bg-white rounded-lg border hover:shadow-sm transition-shadow flex flex-col overflow-hidden">
      {/* Picture */}
      <Link href={`/recipes/${recipe.id}`} className="block">
        {recipe.pictureUrl ? (
          <div className="relative h-36 bg-hayama">
            <Image
              src={recipe.pictureUrl}
              alt={recipe.name}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="h-36 bg-hayama flex items-center justify-center">
            <ChefHat className="h-10 w-10 text-hayama-dark" />
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="p-3 flex flex-col flex-1 gap-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/recipes/${recipe.id}`}
            className="font-semibold text-megumi hover:text-soma leading-tight"
          >
            {recipe.name}
          </Link>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {recipe.base_servings === 1
              ? "1 serving"
              : `${recipe.base_servings} servings`}
          </span>
        </div>

        {descriptionExcerpt && (
          <p className="text-sm text-muted-foreground leading-snug">
            {descriptionExcerpt}
          </p>
        )}

        {/* Card actions */}
        <div className="flex items-center gap-1 mt-auto pt-1 border-t">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
          >
            <Link href={`/recipes/${recipe.id}/edit`}>
              <Pencil className="h-3 w-3" />
              Edit
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive hover:bg-red-50 ml-auto"
            onClick={() => onDelete(recipe)}
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
