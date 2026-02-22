"use client";

import { ChefHat, Package, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { removeMealPlanEntry, undoRemoveMealPlanEntry } from "@/lib/meal-plan-actions";
import type { MealPlanEntryWithRelations } from "@/types/database";

type Props = {
  entry: MealPlanEntryWithRelations;
};

const TYPE_ICONS = {
  recipe: ChefHat,
  product: Package,
  note: FileText,
} as const;

function entryLabel(entry: MealPlanEntryWithRelations): string {
  if (entry.type === "recipe" && entry.recipe) return entry.recipe.name;
  if (entry.type === "product" && entry.product) return entry.product.name;
  if (entry.type === "note" && entry.note) return entry.note;
  return "Unnamed entry";
}

function servingsLabel(entry: MealPlanEntryWithRelations): string | null {
  if (entry.type === "recipe" && entry.recipe_servings != null) {
    return `${entry.recipe_servings} serving${entry.recipe_servings !== 1 ? "s" : ""}`;
  }
  if (entry.type === "product" && entry.product_amount != null) {
    const quName =
      entry.product_qu?.name_plural ??
      entry.product_qu?.name ??
      entry.product?.qu_stock?.name_plural ??
      "";
    return `${entry.product_amount} ${quName}`.trim();
  }
  return null;
}

export function MealPlanEntryCard({ entry }: Props) {
  const router = useRouter();
  const Icon = TYPE_ICONS[entry.type];
  const label = entryLabel(entry);
  const sub = servingsLabel(entry);

  const handleDelete = async () => {
    const result = await removeMealPlanEntry(entry.id);
    if (!result.success) {
      toast.error(result.error ?? "Failed to remove entry.");
      return;
    }

    const snapshot = result.snapshot!;

    toast(`Removed: ${label}`, {
      duration: 8000,
      action: {
        label: "Undo",
        onClick: async () => {
          const undo = await undoRemoveMealPlanEntry(snapshot);
          if (undo.success) {
            router.refresh();
          } else {
            toast.error("Failed to undo.");
          }
        },
      },
    });

    router.refresh();
  };

  return (
    <div className="group flex items-start gap-2 rounded-md bg-background px-3 py-2 text-sm shadow-sm border border-border">
      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-megumi truncate">{label}</p>
        {sub && (
          <p className="text-xs text-muted-foreground">{sub}</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-soma"
        onClick={handleDelete}
        aria-label="Remove entry"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
