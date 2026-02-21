"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, ChefHat } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  addNestedRecipe,
  updateNestedRecipe,
  removeNestedRecipe,
  undoRemoveNestedRecipe,
} from "@/lib/recipe-actions";
import type { Recipe, RecipeNestingWithRelations } from "@/types/database";

type Props = {
  recipe: Recipe;
  initialNestings: RecipeNestingWithRelations[];
  /** All household recipes (for picker, excluding self + already nested) */
  allRecipes: Pick<Recipe, "id" | "name" | "base_servings">[];
};

export function RecipeNestingClient({
  recipe,
  initialNestings,
  allRecipes,
}: Props) {
  const [nestings, setNestings] = useState(initialNestings);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pickedRecipeId, setPickedRecipeId] = useState("");
  const [pickedSearch, setPickedSearch] = useState("");
  const [servings, setServings] = useState("1");
  const [saving, setSaving] = useState(false);

  const nestedIds = new Set(nestings.map((n) => n.includes_recipe_id));

  const availableRecipes = allRecipes.filter(
    (r) => r.id !== recipe.id && !nestedIds.has(r.id)
  );

  const filteredRecipes = pickedSearch.trim()
    ? availableRecipes.filter((r) =>
        r.name.toLowerCase().includes(pickedSearch.toLowerCase())
      )
    : availableRecipes.slice(0, 10);

  const openAdd = () => {
    setEditingId(null);
    setPickedRecipeId("");
    setPickedSearch("");
    setServings("1");
    setShowDialog(true);
  };

  const openEdit = (n: RecipeNestingWithRelations) => {
    setEditingId(n.id);
    setPickedRecipeId(n.includes_recipe_id);
    setPickedSearch(n.included_recipe?.name ?? "");
    setServings(n.servings.toString());
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    const srvNum = parseFloat(servings);
    if (isNaN(srvNum) || srvNum <= 0) {
      toast.error("Enter a valid servings amount.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const result = await updateNestedRecipe(editingId, srvNum);
        if (!result.success) throw new Error(result.error);
        setNestings((prev) =>
          prev.map((n) => (n.id === editingId ? { ...n, servings: srvNum } : n))
        );
      } else {
        if (!pickedRecipeId) {
          toast.error("Select a recipe to nest.");
          setSaving(false);
          return;
        }
        const result = await addNestedRecipe(recipe.id, pickedRecipeId, srvNum);
        if (!result.success) throw new Error(result.error);

        const pickedRecipe = allRecipes.find((r) => r.id === pickedRecipeId);
        const newNesting: RecipeNestingWithRelations = {
          id: result.nestingId!,
          household_id: recipe.household_id,
          recipe_id: recipe.id,
          includes_recipe_id: pickedRecipeId,
          servings: srvNum,
          created_at: new Date().toISOString(),
          included_recipe: pickedRecipe
            ? { id: pickedRecipe.id, name: pickedRecipe.name, base_servings: pickedRecipe.base_servings }
            : null,
        };
        setNestings((prev) => [...prev, newNesting]);
        // Remove from available (update nestedIds implicitly via setNestings)
      }
      closeDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (n: RecipeNestingWithRelations) => {
    setNestings((prev) => prev.filter((x) => x.id !== n.id));

    const result = await removeNestedRecipe(n.id);
    if (!result.success) {
      setNestings((prev) => [...prev, n]);
      toast.error("Failed to remove nested recipe.");
      return;
    }

    const snapshot = result.snapshot!;
    toast("Sub-recipe removed.", {
      duration: 8000,
      action: {
        label: "Undo",
        onClick: async () => {
          const undo = await undoRemoveNestedRecipe(snapshot);
          if (undo.success) setNestings((prev) => [...prev, n]);
          else toast.error("Failed to undo.");
        },
      },
    });
  };

  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-megumi flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-hayama-dark" />
          Sub-recipes
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={openAdd}
          className="gap-1 h-7 px-2 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {nestings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No sub-recipes. Add another recipe as an ingredient.
        </p>
      ) : (
        <div className="space-y-1.5">
          {nestings.map((n) => (
            <div
              key={n.id}
              className="flex items-center gap-2 text-sm py-1.5 border-b last:border-b-0"
            >
              <span className="flex-1 font-medium text-gray-800 truncate">
                {n.included_recipe?.name ?? "Unknown recipe"}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {n.servings === 1 ? "1 serving" : `${n.servings} servings`}
              </span>
              <button
                type="button"
                onClick={() => openEdit(n)}
                className="shrink-0 p-1 text-muted-foreground hover:text-megumi rounded"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(n)}
                className="shrink-0 p-1 text-muted-foreground hover:text-destructive rounded"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit sub-recipe" : "Add sub-recipe"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!editingId && (
              <div className="space-y-1.5">
                <Label>Recipe</Label>
                <div className="relative">
                  <Input
                    value={pickedSearch}
                    onChange={(e) => {
                      setPickedSearch(e.target.value);
                      setPickedRecipeId("");
                    }}
                    placeholder="Search recipes..."
                    autoFocus
                  />
                  {pickedRecipeId && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm font-medium text-megumi">
                        {allRecipes.find((r) => r.id === pickedRecipeId)?.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPickedRecipeId("");
                          setPickedSearch("");
                        }}
                        className="text-xs text-muted-foreground hover:text-gray-700"
                      >
                        Change
                      </button>
                    </div>
                  )}
                  {!pickedRecipeId && pickedSearch.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto border rounded-md bg-white shadow-md">
                      {filteredRecipes.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">
                          No recipes found.
                        </p>
                      ) : (
                        filteredRecipes.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setPickedRecipeId(r.id);
                              setPickedSearch(r.name);
                              setServings(r.base_servings.toString());
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-hayama border-b last:border-b-0"
                          >
                            {r.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="nesting-servings">Servings to use</Label>
              <Input
                id="nesting-servings"
                type="number"
                min="0.25"
                step="0.25"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-soma text-white hover:bg-soma-dark"
            >
              {saving ? "Saving..." : editingId ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
