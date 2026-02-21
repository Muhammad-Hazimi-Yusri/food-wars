"use client";

import { useState, useMemo } from "react";
import { CheckCircle, XCircle, ShoppingCart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  consumeRecipe,
  undoConsumeRecipe,
  addMissingToShoppingList,
} from "@/lib/recipe-actions";
import {
  computeRecipeFulfillment,
  formatScaledAmount,
} from "@/lib/recipe-utils";
import type {
  Recipe,
  RecipeIngredientWithRelations,
  ShoppingList,
} from "@/types/database";

type Props = {
  recipe: Recipe;
  /** All ingredients including nested (used for fulfillment display) */
  ingredients: RecipeIngredientWithRelations[];
  /** Only direct recipe ingredients (used for the cook/consume action) */
  ownIngredients: RecipeIngredientWithRelations[];
  /** product_id → total amount in stock */
  stockByProduct: Record<string, number>;
  shoppingLists: ShoppingList[];
  desiredServings: number;
};

export function RecipeFulfillment({
  recipe,
  ingredients,
  ownIngredients,
  stockByProduct,
  shoppingLists,
  desiredServings,
}: Props) {
  const [cooking, setCooking] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);

  const stockMap = useMemo(
    () => new Map(Object.entries(stockByProduct)),
    [stockByProduct]
  );

  const fulfillment = useMemo(
    () =>
      computeRecipeFulfillment(
        ingredients,
        stockMap,
        recipe.base_servings,
        desiredServings
      ),
    [ingredients, stockMap, recipe.base_servings, desiredServings]
  );

  const missingList = fulfillment.ingredients.filter(
    (f) => !f.fulfilled && !f.skipped
  );

  const checkableCount = fulfillment.ingredients.filter((f) => !f.skipped).length;

  if (ingredients.length === 0) return null;

  const handleCook = async () => {
    setCooking(true);
    const result = await consumeRecipe(recipe, ownIngredients, desiredServings);
    setCooking(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to cook recipe.");
      return;
    }

    toast("Recipe cooked! Stock updated.", {
      duration: 8000,
      action: {
        label: "Undo",
        onClick: async () => {
          const undo = await undoConsumeRecipe(result.correlationId!);
          if (undo.success) toast.success("Cooking undone.");
          else toast.error("Failed to undo.");
        },
      },
    });
  };

  const handleAddMissing = async (listId: string) => {
    const missing = missingList
      .map((f) => {
        const ing = ingredients.find((i) => i.id === f.ingredientId);
        if (!ing || !f.productId) return null;
        return {
          productId: f.productId,
          amount: parseFloat(f.missing.toFixed(2)),
          quId: ing.qu_id,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    const result = await addMissingToShoppingList(missing, listId);
    if (result.success) {
      toast.success("Missing ingredients added to list.");
      setShowListPicker(false);
    } else {
      toast.error(result.error ?? "Failed to add to list.");
    }
  };

  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      {/* Header row: badge + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {fulfillment.canMake ? (
            <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 text-red-400 shrink-0" />
          )}
          <span className="font-semibold text-megumi text-sm">
            {fulfillment.canMake
              ? "Ready to cook"
              : checkableCount === 0
              ? "No stock checks"
              : `${missingList.length} ingredient${missingList.length !== 1 ? "s" : ""} missing`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {missingList.length > 0 && shoppingLists.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-8"
              onClick={() => setShowListPicker(true)}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Add missing
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleCook}
            disabled={cooking || !fulfillment.canMake || checkableCount === 0}
            className="bg-soma text-white hover:bg-soma-dark h-8 text-xs"
          >
            {cooking ? "Cooking..." : "Cook"}
          </Button>
        </div>
      </div>

      {/* Progress bar (only when not fully stocked) */}
      {fulfillment.fulfillmentRatio < 1 && checkableCount > 0 && (
        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-400 rounded-full transition-all"
            style={{ width: `${fulfillment.fulfillmentRatio * 100}%` }}
          />
        </div>
      )}

      {/* Per-ingredient fulfillment rows (only checkable ones) */}
      {checkableCount > 0 && (
        <div className="space-y-1">
          {fulfillment.ingredients.map((f) => {
            if (f.skipped) return null;
            const ing = ingredients.find((i) => i.id === f.ingredientId);
            const quName = ing?.qu?.name ?? "";
            return (
              <div key={f.ingredientId} className="flex items-center gap-2 text-sm">
                <div
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    f.fulfilled ? "bg-green-400" : "bg-red-400"
                  }`}
                />
                <span className="flex-1 truncate text-gray-700">
                  {ing?.product?.name ?? "Unknown product"}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  need {formatScaledAmount(f.needed)}
                  {quName ? ` ${quName}` : ""} · have{" "}
                  {formatScaledAmount(f.inStock)}
                  {!f.fulfilled && (
                    <span className="text-red-500 ml-1">
                      · missing {formatScaledAmount(f.missing)}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Shopping list picker dialog */}
      <Dialog open={showListPicker} onOpenChange={setShowListPicker}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Add missing to list</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {shoppingLists.map((list) => (
              <Button
                key={list.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleAddMissing(list.id)}
              >
                {list.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
