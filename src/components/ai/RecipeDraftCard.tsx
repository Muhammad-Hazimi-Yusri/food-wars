"use client";

import { useState } from "react";
import { Loader2, X, ChefHat, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createRecipe, addIngredient } from "@/lib/recipe-actions";
import type { RecipeDraft, RecipeDraftIngredient } from "@/types/ai";

type Props = {
  draft: RecipeDraft;
};

export function RecipeDraftCard({ draft }: Props) {
  const [name, setName] = useState(draft.name);
  const [servings, setServings] = useState(draft.base_servings);
  const [ingredients, setIngredients] = useState<RecipeDraftIngredient[]>(draft.ingredients);
  const [saving, setSaving] = useState(false);
  const [savedRecipeId, setSavedRecipeId] = useState<string | null>(null);

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await createRecipe({
        name: name.trim() || draft.name,
        description: draft.description,
        instructions: draft.instructions,
        base_servings: servings,
      });
      if (!result.success || !result.recipeId) {
        throw new Error(result.error ?? "Failed to create recipe");
      }
      for (const ing of ingredients) {
        await addIngredient(result.recipeId, {
          product_id: ing.product_id,
          amount: ing.amount,
          qu_id: ing.qu_id,
          note: ing.note,
          ingredient_group: ing.ingredient_group,
          variable_amount: ing.variable_amount,
        });
      }
      setSavedRecipeId(result.recipeId);
      toast.success("Recipe saved!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save recipe");
    } finally {
      setSaving(false);
    }
  };

  // Instructions preview: first 3 non-empty lines
  const instructionLines = (draft.instructions ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (savedRecipeId) {
    return (
      <div className="mt-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm">
        <div className="flex items-center gap-1.5 text-green-700 font-medium mb-2">
          <ChefHat className="h-4 w-4" />
          <span>&ldquo;{name}&rdquo; saved</span>
        </div>
        <div className="flex gap-2">
          <a
            href={`/recipes/${savedRecipeId}`}
            className="text-xs text-megumi hover:underline flex items-center gap-1"
          >
            View Recipe <ExternalLink className="h-3 w-3" />
          </a>
          <span className="text-gray-300">|</span>
          <a
            href={`/recipes/${savedRecipeId}/edit`}
            className="text-xs text-gray-500 hover:underline flex items-center gap-1"
          >
            Edit Recipe <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-gray-200 bg-white text-sm">
      {/* Header */}
      <div className="p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-sm font-medium flex-1 border-transparent bg-transparent px-0 focus-visible:border-gray-200 focus-visible:bg-white focus-visible:px-2"
            aria-label="Recipe name"
          />
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-gray-500 whitespace-nowrap">Servings:</span>
            <button
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              className="h-5 w-5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center text-xs leading-none"
              aria-label="Decrease servings"
            >
              −
            </button>
            <span className="text-xs font-medium w-5 text-center">{servings}</span>
            <button
              onClick={() => setServings((s) => s + 1)}
              className="h-5 w-5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center text-xs leading-none"
              aria-label="Increase servings"
            >
              +
            </button>
          </div>
        </div>
        {draft.description && (
          <p className="text-xs text-gray-400 line-clamp-1">{draft.description}</p>
        )}
      </div>

      {/* Ingredients */}
      {ingredients.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-2 space-y-1">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">
            Ingredients
          </p>
          {ingredients.map((ing, i) => (
            <div key={i} className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {ing.product_id ? (
                  <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded shrink-0">
                    Matched
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
                    No match
                  </span>
                )}
                <span className="text-xs text-gray-700 truncate">
                  {ing.amount > 0 && `${ing.amount} `}
                  {ing.unit_name && `${ing.unit_name} `}
                  <span className="font-medium">{ing.product_name}</span>
                  {ing.note && <span className="text-gray-400"> — {ing.note}</span>}
                </span>
              </div>
              <button
                onClick={() => removeIngredient(i)}
                className="text-gray-300 hover:text-gray-500 shrink-0"
                aria-label={`Remove ${ing.product_name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Instructions preview */}
      {instructionLines.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-2">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">
            Instructions
          </p>
          <div className="space-y-0.5">
            {instructionLines.map((line, i) => (
              <p key={i} className="text-xs text-gray-500 truncate">
                {line}
              </p>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1 italic">Full instructions included</p>
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-gray-100 px-3 py-2">
        <Button
          size="sm"
          className="w-full bg-megumi hover:bg-megumi/90 text-white text-xs h-7"
          onClick={handleSave}
          disabled={saving || ingredients.length === 0}
        >
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              Saving…
            </>
          ) : (
            "Save Recipe"
          )}
        </Button>
      </div>
    </div>
  );
}
