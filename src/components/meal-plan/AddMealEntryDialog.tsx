"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChefHat, Package, FileText, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { addMealPlanEntry } from "@/lib/meal-plan-actions";
import type { MealPlanSection, Recipe, Product } from "@/types/database";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: string; // YYYY-MM-DD
  defaultSectionId: string | null;
  sections: MealPlanSection[];
  recipes: Pick<Recipe, "id" | "name" | "base_servings" | "picture_file_name">[];
  products: Pick<Product, "id" | "name">[];
  onSuccess: () => void;
};

type EntryType = "recipe" | "product" | "note";

export function AddMealEntryDialog({
  open,
  onOpenChange,
  day,
  defaultSectionId,
  sections,
  recipes,
  products,
  onSuccess,
}: Props) {
  const [type, setType] = useState<EntryType>("recipe");
  const [sectionId, setSectionId] = useState<string | null>(defaultSectionId);
  const [recipeId, setRecipeId] = useState<string>("");
  const [servings, setServings] = useState<number>(1);
  const [productId, setProductId] = useState<string>("");
  const [amount, setAmount] = useState<number>(1);
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const selectedRecipe = recipes.find((r) => r.id === recipeId);

  // When recipe changes, pre-fill servings from base_servings
  const handleRecipeChange = (id: string) => {
    setRecipeId(id);
    const r = recipes.find((r) => r.id === id);
    if (r) setServings(r.base_servings ?? 1);
  };

  const handleTypeChange = (t: EntryType) => {
    setType(t);
    // Reset fields on type switch
    setRecipeId("");
    setProductId("");
    setNote("");
    setServings(1);
    setAmount(1);
  };

  const handleSubmit = async () => {
    // Validation
    if (type === "recipe" && !recipeId) {
      toast.error("Please select a recipe.");
      return;
    }
    if (type === "product" && !productId) {
      toast.error("Please select a product.");
      return;
    }
    if (type === "note" && !note.trim()) {
      toast.error("Please enter a note.");
      return;
    }

    setSaving(true);
    const result = await addMealPlanEntry({
      day,
      type,
      section_id: sectionId,
      recipe_id: type === "recipe" ? recipeId : null,
      recipe_servings: type === "recipe" ? servings : null,
      product_id: type === "product" ? productId : null,
      product_amount: type === "product" ? amount : null,
      note: type === "note" ? note.trim() : null,
    });
    setSaving(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to add entry.");
      return;
    }

    // Reset state
    setRecipeId("");
    setProductId("");
    setNote("");
    setServings(1);
    setAmount(1);
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Meal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type selector */}
          <div className="flex gap-2">
            {(["recipe", "product", "note"] as EntryType[]).map((t) => {
              const Icon = t === "recipe" ? ChefHat : t === "product" ? Package : FileText;
              const label = t === "recipe" ? "Recipe" : t === "product" ? "Product" : "Note";
              return (
                <button
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  className={`flex-1 flex flex-col items-center gap-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    type === t
                      ? "border-soma bg-soma/10 text-soma"
                      : "border-border text-muted-foreground hover:border-soma/50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Section picker */}
          {sections.length > 0 && (
            <div className="space-y-1.5">
              <Label>Section</Label>
              <Select
                value={sectionId ?? "none"}
                onValueChange={(v) => setSectionId(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No section</SelectItem>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Recipe fields */}
          {type === "recipe" && (
            <>
              <div className="space-y-1.5">
                <Label>Recipe</Label>
                <Select value={recipeId} onValueChange={handleRecipeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a recipe…" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Servings</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setServings((s) => Math.max(0.5, s - 0.5))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={servings}
                    onChange={(e) => setServings(parseFloat(e.target.value) || 1)}
                    className="text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setServings((s) => s + 0.5)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {selectedRecipe && (
                  <p className="text-xs text-muted-foreground">
                    Base: {selectedRecipe.base_servings} serving{selectedRecipe.base_servings !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Product fields */}
          {type === "product" && (
            <>
              <div className="space-y-1.5">
                <Label>Product</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product…" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Amount</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setAmount((a) => Math.max(0.5, a - 0.5))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 1)}
                    className="text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setAmount((a) => a + 0.5)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Note field */}
          {type === "note" && (
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea
                placeholder="e.g. Try the new Thai place"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Adding…" : "Add Meal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
