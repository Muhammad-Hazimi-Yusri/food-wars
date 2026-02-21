"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { toast } from "sonner";
import {
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  ChevronRight,
} from "lucide-react";
import {
  addIngredient,
  updateIngredient,
  removeIngredient,
  undoRemoveIngredient,
  reorderIngredients,
} from "@/lib/recipe-actions";
import type {
  Recipe,
  RecipeIngredientWithRelations,
  QuantityUnit,
} from "@/types/database";

type Product = {
  id: string;
  name: string;
  qu_id_stock: string | null;
  not_check_stock_fulfillment_for_recipes: boolean;
};

type Props = {
  recipe: Recipe;
  initialIngredients: RecipeIngredientWithRelations[];
  products: Product[];
  quantityUnits: QuantityUnit[];
};

type IngredientFormState = {
  productId: string;
  productSearch: string;
  amount: string;
  quId: string;
  group: string;
  note: string;
  variableAmount: string;
  notCheckStock: boolean;
  onlySingleUnit: boolean;
};

const EMPTY_FORM: IngredientFormState = {
  productId: "",
  productSearch: "",
  amount: "1",
  quId: "",
  group: "",
  note: "",
  variableAmount: "",
  notCheckStock: false,
  onlySingleUnit: false,
};

// ============================================
// SORTABLE ITEM WRAPPER
// ============================================

function SortableItem({
  id,
  children,
}: {
  id: string;
  children: (props: {
    attributes: ReturnType<typeof useSortable>["attributes"];
    listeners: ReturnType<typeof useSortable>["listeners"];
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function RecipeIngredientsClient({
  recipe,
  initialIngredients,
  products,
  quantityUnits,
}: Props) {
  const router = useRouter();
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<IngredientFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Derive existing groups for autocomplete
  const existingGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const ing of ingredients) {
      if (ing.ingredient_group) groups.add(ing.ingredient_group);
    }
    return [...groups].sort();
  }, [ingredients]);

  // Group ingredients by ingredient_group
  const grouped = useMemo(() => {
    const ungrouped: RecipeIngredientWithRelations[] = [];
    const groups = new Map<string, RecipeIngredientWithRelations[]>();

    for (const ing of ingredients) {
      if (!ing.ingredient_group) {
        ungrouped.push(ing);
      } else {
        const arr = groups.get(ing.ingredient_group) ?? [];
        arr.push(ing);
        groups.set(ing.ingredient_group, arr);
      }
    }

    return { ungrouped, groups: [...groups.entries()] };
  }, [ingredients]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ============================================
  // DRAG AND DROP
  // ============================================

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ingredients.findIndex((i) => i.id === active.id);
    const newIndex = ingredients.findIndex((i) => i.id === over.id);
    const newIngredients = arrayMove(ingredients, oldIndex, newIndex);
    setIngredients(newIngredients);

    const result = await reorderIngredients(newIngredients.map((i) => i.id));
    if (!result.success) {
      setIngredients(ingredients);
      toast.error("Failed to reorder ingredients.");
    }
  };

  // ============================================
  // ADD / EDIT DIALOG
  // ============================================

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openEdit = (ing: RecipeIngredientWithRelations) => {
    setEditingId(ing.id);
    setForm({
      productId: ing.product_id ?? "",
      productSearch: ing.product?.name ?? "",
      amount: ing.amount.toString(),
      quId: ing.qu_id ?? "",
      group: ing.ingredient_group ?? "",
      note: ing.note ?? "",
      variableAmount: ing.variable_amount ?? "",
      notCheckStock: ing.not_check_stock_fulfillment,
      onlySingleUnit: ing.only_check_single_unit_in_stock,
    });
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    const amount = parseFloat(form.amount);
    if (!form.variableAmount && (isNaN(amount) || amount <= 0)) {
      toast.error("Enter a valid amount, or use variable amount.");
      return;
    }

    setSaving(true);
    try {
      const params = {
        product_id: form.productId || null,
        amount: isNaN(amount) ? 1 : amount,
        qu_id: form.quId || null,
        note: form.note.trim() || null,
        ingredient_group: form.group.trim() || null,
        variable_amount: form.variableAmount.trim() || null,
        not_check_stock_fulfillment: form.notCheckStock,
        only_check_single_unit_in_stock: form.onlySingleUnit,
      };

      if (editingId) {
        const result = await updateIngredient(editingId, params);
        if (!result.success) throw new Error(result.error);

        // Update local state
        setIngredients((prev) =>
          prev.map((ing) =>
            ing.id === editingId
              ? {
                  ...ing,
                  ...params,
                  product: products.find((p) => p.id === params.product_id) ?? null,
                  qu: quantityUnits.find((q) => q.id === params.qu_id) ?? null,
                }
              : ing
          )
        );
      } else {
        const result = await addIngredient(recipe.id, params);
        if (!result.success) throw new Error(result.error);

        // Refresh to get new ingredient with id
        router.refresh();
      }

      closeDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save ingredient.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (ing: RecipeIngredientWithRelations) => {
    setIngredients((prev) => prev.filter((i) => i.id !== ing.id));

    const result = await removeIngredient(ing.id);
    if (!result.success) {
      setIngredients((prev) => {
        const arr = [...prev];
        arr.splice(ing.sort_order, 0, ing);
        return arr;
      });
      toast.error("Failed to remove ingredient.");
      return;
    }

    const snapshot = result.snapshot!;
    toast("Ingredient removed.", {
      duration: 8000,
      action: {
        label: "Undo",
        onClick: async () => {
          const undo = await undoRemoveIngredient(snapshot);
          if (undo.success) router.refresh();
          else toast.error("Failed to undo.");
        },
      },
    });
  };

  // ============================================
  // PRODUCT SEARCH
  // ============================================

  const filteredProducts = useMemo(() => {
    if (!form.productSearch.trim()) return products.slice(0, 10);
    const q = form.productSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 10);
  }, [products, form.productSearch]);

  const showProductDropdown =
    showDialog && !form.productId && form.productSearch.length > 0;

  // ============================================
  // RENDER INGREDIENT ROW
  // ============================================

  function IngredientRow({ ing }: { ing: RecipeIngredientWithRelations }) {
    const displayAmount = ing.variable_amount
      ? ing.variable_amount
      : `${ing.amount}${ing.qu ? ` ${ing.qu.name}` : ""}`;

    return (
      <div className="flex items-center gap-2 bg-white border rounded-md px-3 py-2 text-sm">
        <span className="font-medium text-megumi flex-1 min-w-0 truncate">
          {ing.product?.name ?? (
            <span className="text-muted-foreground italic">No product</span>
          )}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs">
          {displayAmount}
        </span>
        {ing.note && (
          <span className="text-muted-foreground shrink-0 text-xs italic hidden sm:inline">
            {ing.note}
          </span>
        )}
        <button
          type="button"
          onClick={() => openEdit(ing)}
          className="shrink-0 p-1 text-muted-foreground hover:text-megumi rounded"
          title="Edit ingredient"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => handleRemove(ing)}
          className="shrink-0 p-1 text-muted-foreground hover:text-destructive rounded"
          title="Remove ingredient"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-megumi">Ingredients</h2>
        <Button
          size="sm"
          onClick={openAdd}
          className="bg-soma text-white hover:bg-soma-dark gap-1"
        >
          <Plus className="h-4 w-4" />
          Add Ingredient
        </Button>
      </div>

      {/* Empty state */}
      {ingredients.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No ingredients yet. Add your first ingredient.
        </p>
      )}

      {/* Ingredient list with DnD */}
      {ingredients.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-4">
            {/* Ungrouped ingredients */}
            {grouped.ungrouped.length > 0 && (
              <SortableContext
                items={grouped.ungrouped.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1.5">
                  {grouped.ungrouped.map((ing) => (
                    <SortableItem key={ing.id} id={ing.id}>
                      {({ attributes, listeners }) => (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="shrink-0 cursor-grab text-muted-foreground hover:text-megumi touch-none p-0.5"
                            {...attributes}
                            {...listeners}
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                          <div className="flex-1">
                            <IngredientRow ing={ing} />
                          </div>
                        </div>
                      )}
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            )}

            {/* Grouped ingredients */}
            {grouped.groups.map(([groupKey, groupItems]) => {
              const isCollapsed = collapsedGroups.has(groupKey);
              return (
                <div key={groupKey}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupKey)}
                    className="flex items-center gap-2 w-full text-left mb-1.5 group"
                  >
                    <ChevronRight
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        isCollapsed ? "" : "rotate-90"
                      }`}
                    />
                    <span className="text-sm font-semibold text-megumi group-hover:text-soma">
                      {groupKey}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({groupItems.length})
                    </span>
                  </button>

                  {!isCollapsed && (
                    <SortableContext
                      items={groupItems.map((i) => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-1.5 ml-6">
                        {groupItems.map((ing) => (
                          <SortableItem key={ing.id} id={ing.id}>
                            {({ attributes, listeners }) => (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  className="shrink-0 cursor-grab text-muted-foreground hover:text-megumi touch-none p-0.5"
                                  {...attributes}
                                  {...listeners}
                                >
                                  <GripVertical className="h-4 w-4" />
                                </button>
                                <div className="flex-1">
                                  <IngredientRow ing={ing} />
                                </div>
                              </div>
                            )}
                          </SortableItem>
                        ))}
                      </div>
                    </SortableContext>
                  )}
                </div>
              );
            })}
          </div>
        </DndContext>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Ingredient" : "Add Ingredient"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Product picker */}
            <div className="space-y-1.5">
              <Label>Product</Label>
              <div className="relative">
                <Input
                  value={form.productSearch}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      productSearch: e.target.value,
                      productId: "",
                    }))
                  }
                  placeholder="Search products..."
                  autoFocus={!editingId}
                />
                {form.productId && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm font-medium text-megumi">
                      {products.find((p) => p.id === form.productId)?.name}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, productId: "", productSearch: "" }))
                      }
                      className="text-xs text-muted-foreground hover:text-gray-700"
                    >
                      Change
                    </button>
                  </div>
                )}
                {showProductDropdown && (
                  <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto border rounded-md bg-white shadow-md">
                    {filteredProducts.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        No products found.
                      </p>
                    ) : (
                      filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              productId: p.id,
                              productSearch: p.name,
                              // Auto-set QU from product stock unit
                              quId: f.quId || p.qu_id_stock || "",
                            }))
                          }
                          className="w-full text-left px-3 py-2 text-sm hover:bg-hayama border-b last:border-b-0"
                        >
                          {p.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Variable amount OR numeric amount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  disabled={!!form.variableAmount}
                  placeholder="e.g. 200"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qu">Unit</Label>
                <Select
                  value={form.quId}
                  onValueChange={(v) => setForm((f) => ({ ...f, quId: v }))}
                  disabled={!!form.variableAmount}
                >
                  <SelectTrigger id="qu">
                    <SelectValue placeholder="Unit..." />
                  </SelectTrigger>
                  <SelectContent>
                    {quantityUnits.map((qu) => (
                      <SelectItem key={qu.id} value={qu.id}>
                        {qu.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Variable amount */}
            <div className="space-y-1.5">
              <Label htmlFor="variable">Variable Amount</Label>
              <Input
                id="variable"
                value={form.variableAmount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, variableAmount: e.target.value }))
                }
                placeholder='e.g. "to taste", "a pinch" (overrides amount)'
              />
            </div>

            {/* Group */}
            <div className="space-y-1.5">
              <Label htmlFor="group">Ingredient Group</Label>
              <Input
                id="group"
                value={form.group}
                onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
                placeholder="e.g. For the sauce, Toppings"
                list="group-suggestions"
              />
              {existingGroups.length > 0 && (
                <datalist id="group-suggestions">
                  {existingGroups.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              )}
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label htmlFor="note">Prep Note</Label>
              <Input
                id="note"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder='e.g. "diced", "room temp", "optional"'
              />
            </div>

            {/* Flags */}
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.notCheckStock}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notCheckStock: e.target.checked }))
                  }
                  className="rounded"
                />
                Skip stock fulfillment check
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.onlySingleUnit}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, onlySingleUnit: e.target.checked }))
                  }
                  className="rounded"
                />
                Only check single unit in stock
              </label>
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
