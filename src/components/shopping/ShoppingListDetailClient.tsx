"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Check,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ListChecks,
  Loader2,
  Package,
  StickyNote,
  AlertTriangle,
  Clock,
  TrendingDown,
  Tags,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import {
  addItemToList,
  removeItemFromList,
  toggleItemDone,
  clearDoneItems,
  reorderItems,
  updateItemAmount,
  purchaseItem,
} from "@/lib/shopping-list-actions";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  computeBelowMinStock,
  computeExpiredProducts,
  computeOverdueProducts,
} from "@/lib/shopping-list-utils";
import type {
  ShoppingList,
  ShoppingListItemWithRelations,
  StockEntryWithProduct,
  Product,
  QuantityUnit,
} from "@/types/database";

type QuantityUnitConversion = {
  id: string;
  product_id: string | null;
  from_qu_id: string;
  to_qu_id: string;
  factor: number;
};

type ProductWithUnits = Product & {
  qu_stock?: QuantityUnit | null;
  qu_purchase?: QuantityUnit | null;
};

type Props = {
  list: ShoppingList;
  initialItems: ShoppingListItemWithRelations[];
  products: ProductWithUnits[];
  quantityUnits: QuantityUnit[];
  conversions: QuantityUnitConversion[];
  stockEntries: StockEntryWithProduct[];
};

// ============================================
// Sortable item wrapper
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
// Item row component
// ============================================

function ItemRow({
  item,
  isDragging,
  dragAttributes,
  dragListeners,
  onToggleDone,
  onAmountChange,
  onDelete,
  getItemLabel,
  getUnitLabel,
  stockEntries,
}: {
  item: ShoppingListItemWithRelations;
  isDragging: boolean;
  dragAttributes: ReturnType<typeof useSortable>["attributes"];
  dragListeners: ReturnType<typeof useSortable>["listeners"];
  onToggleDone: (item: ShoppingListItemWithRelations) => void;
  onAmountChange: (item: ShoppingListItemWithRelations, delta: number) => void;
  onDelete: (id: string) => void;
  getItemLabel: (item: ShoppingListItemWithRelations) => string;
  getUnitLabel: (item: ShoppingListItemWithRelations) => string;
  stockEntries: StockEntryWithProduct[];
}) {
  const currentStock = item.product
    ? stockEntries
        .filter((e) => e.product_id === item.product!.id)
        .reduce((sum, e) => sum + e.amount, 0)
    : null;

  const stockUnitName = item.product?.qu_purchase?.name ?? "";

  return (
    <div
      className={`flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-3 ${
        isDragging ? "shadow-lg" : ""
      }`}
    >
      <button
        className="touch-none text-gray-400 hover:text-gray-600 cursor-grab"
        {...dragAttributes}
        {...dragListeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        onClick={() => onToggleDone(item)}
        className="w-5 h-5 rounded border-2 border-gray-300 hover:border-megumi flex items-center justify-center shrink-0 transition-colors"
      >
        {item.done && <Check className="h-3 w-3 text-megumi" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {item.product ? (
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 hover:text-megumi transition-colors text-left min-w-0">
                  <Package className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="font-medium text-sm truncate underline decoration-dotted underline-offset-2">
                    {getItemLabel(item)}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="start" side="bottom" sideOffset={4}>
                <h4 className="font-semibold text-sm mb-2">{item.product.name}</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Min stock:</span>
                    <span>{item.product.min_stock_amount ?? 0} {stockUnitName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">In stock:</span>
                    <span>{currentStock ?? 0} {stockUnitName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">On list:</span>
                    <span>{item.amount} {getUnitLabel(item)}</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <>
              <StickyNote className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <span className="font-medium text-sm truncate">
                {getItemLabel(item)}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onAmountChange(item, -1)}
          className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
        <span className="text-sm font-medium w-12 text-center tabular-nums">
          {item.amount} {getUnitLabel(item)}
        </span>
        <button
          onClick={() => onAmountChange(item, 1)}
          className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
      </div>

      <button
        onClick={() => onDelete(item.id)}
        className="text-gray-400 hover:text-red-500 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ============================================
// Main component
// ============================================

export function ShoppingListDetailClient({
  list,
  initialItems,
  products,
  quantityUnits,
  conversions,
  stockEntries,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addMode, setAddMode] = useState<"product" | "freeform">("product");

  // Sync items when server data changes (after router.refresh)
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // Add product form state
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [amount, setAmount] = useState(1);
  const [selectedQuId, setSelectedQuId] = useState("");

  // Add freeform form state
  const [freeformNote, setFreeformNote] = useState("");
  const [freeformAmount, setFreeformAmount] = useState(1);
  const [freeformQuId, setFreeformQuId] = useState("");

  const [saving, setSaving] = useState(false);

  // Auto-generation — tracks which button is loading
  const [generating, setGenerating] = useState<string | null>(null);

  const handleGenerate = async (
    type: "below-min" | "expired" | "overdue"
  ) => {
    setGenerating(type);
    try {
      const gapItems =
        type === "below-min"
          ? computeBelowMinStock(stockEntries, products)
          : type === "expired"
            ? computeExpiredProducts(stockEntries, products)
            : computeOverdueProducts(stockEntries, products);

      if (gapItems.length === 0) {
        toast("No items to add");
        return;
      }

      let added = 0;
      for (const gap of gapItems) {
        const result = await addItemToList(
          list.id,
          {
            productId: gap.productId,
            amount: gap.missingAmount,
            quId: gap.quId,
          },
          items
        );
        if (result.success) added++;
      }

      toast(`Added ${added} item${added === 1 ? "" : "s"} to list`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate items"
      );
    } finally {
      setGenerating(null);
    }
  };

  // Grouping
  type GroupBy = "none" | "aisle" | "store";
  const [groupBy, setGroupBy] = useState<GroupBy>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("shopping-list-group-by") as GroupBy) ?? "none";
    }
    return "none";
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const handleGroupByChange = (value: GroupBy) => {
    setGroupBy(value);
    setCollapsedGroups(new Set());
    localStorage.setItem("shopping-list-group-by", value);
  };

  const toggleGroupCollapsed = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  // Sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Stats
  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((i) => i.done).length;
    return { total, done };
  }, [items]);

  const undoneItems = items.filter((i) => !i.done);
  const doneItems = items.filter((i) => i.done);

  // Group undone items
  const groupedUndoneItems = useMemo(() => {
    if (groupBy === "none") return null;

    const groups = new Map<string, { label: string; items: ShoppingListItemWithRelations[] }>();
    const ungroupedKey = "__ungrouped__";

    for (const item of undoneItems) {
      let groupKey = ungroupedKey;
      let groupLabel = "Other";

      if (groupBy === "aisle" && item.product?.product_group) {
        groupKey = item.product.product_group.id;
        groupLabel = item.product.product_group.name;
      } else if (groupBy === "store" && item.product?.shopping_location) {
        groupKey = item.product.shopping_location.id;
        groupLabel = item.product.shopping_location.name;
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, { label: groupLabel, items: [] });
      }
      groups.get(groupKey)!.items.push(item);
    }

    // Sort: named groups first (alphabetically), ungrouped last
    const sorted = [...groups.entries()].sort((a, b) => {
      if (a[0] === ungroupedKey) return 1;
      if (b[0] === ungroupedKey) return -1;
      return a[1].label.localeCompare(b[1].label);
    });

    return sorted;
  }, [groupBy, undoneItems]);

  // Filter products for search
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  // When product is selected, set default unit
  const handleProductSelect = useCallback(
    (productId: string) => {
      setSelectedProductId(productId);
      const product = products.find((p) => p.id === productId);
      if (product?.qu_id_purchase) {
        setSelectedQuId(product.qu_id_purchase);
      }
    },
    [products]
  );

  const resetAddForm = () => {
    setSelectedProductId("");
    setProductSearch("");
    setAmount(1);
    setSelectedQuId("");
    setFreeformNote("");
    setFreeformAmount(1);
    setFreeformQuId("");
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (addMode === "product") {
        if (!selectedProductId) return;
        const result = await addItemToList(
          list.id,
          { productId: selectedProductId, amount, quId: selectedQuId || null },
          items
        );
        if (!result.success) throw new Error(result.error);
        toast("Item added");
      } else {
        if (!freeformNote.trim()) return;
        const result = await addItemToList(
          list.id,
          {
            note: freeformNote.trim(),
            amount: freeformAmount,
            quId: freeformQuId || null,
          },
          items
        );
        if (!result.success) throw new Error(result.error);
        toast("Item added");
      }

      resetAddForm();
      setShowAddDialog(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDone = async (item: ShoppingListItemWithRelations) => {
    const markingDone = !item.done;

    // Product-linked item being checked off → purchase & add to stock
    if (markingDone && item.product) {
      // Optimistic: remove from list immediately
      setItems((prev) => prev.filter((i) => i.id !== item.id));

      const result = await purchaseItem(
        item.id,
        item.product.id,
        item.amount,
        item.qu_id ?? item.product.qu_id_purchase ?? null,
        conversions,
        {
          qu_id_stock: item.product.qu_id_stock ?? null,
          location_id: item.product.location_id ?? null,
          shopping_location_id: item.product.shopping_location_id ?? null,
          default_due_days: item.product.default_due_days ?? 0,
        }
      );

      if (result.success) {
        toast("Purchased & added to stock");
      } else {
        // Revert
        setItems((prev) => [...prev, item].sort((a, b) => a.sort_order - b.sort_order));
        toast.error(result.error ?? "Failed to purchase");
      }
      return;
    }

    // Freeform item or un-checking a done item → toggle done flag
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i))
    );

    const result = await toggleItemDone(item.id, markingDone);
    if (!result.success) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, done: item.done } : i))
      );
      toast.error(result.error ?? "Failed to update");
    }
  };

  const handleDelete = async (itemId: string) => {
    const result = await removeItemFromList(itemId);
    if (result.success) {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } else {
      toast.error(result.error ?? "Failed to delete");
    }
  };

  const handleClearDone = async () => {
    const result = await clearDoneItems(list.id);
    if (result.success) {
      setItems((prev) => prev.filter((i) => !i.done));
      toast(`Cleared ${result.count} item${result.count === 1 ? "" : "s"}`);
    } else {
      toast.error(result.error ?? "Failed to clear");
    }
  };

  const handleAmountChange = async (
    item: ShoppingListItemWithRelations,
    delta: number
  ) => {
    const newAmount = Math.max(0.25, item.amount + delta);
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, amount: newAmount } : i))
    );
    const result = await updateItemAmount(item.id, newAmount);
    if (!result.success) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, amount: item.amount } : i))
      );
      toast.error(result.error ?? "Failed to update amount");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);

    const result = await reorderItems(newItems.map((i) => i.id));
    if (!result.success) {
      setItems(items); // Revert
      toast.error("Failed to reorder");
    }
  };

  const getItemLabel = (item: ShoppingListItemWithRelations) => {
    if (item.product) return item.product.name;
    return item.note ?? "Unnamed item";
  };

  const getUnitLabel = (item: ShoppingListItemWithRelations) => {
    const qu = item.qu ?? item.product?.qu_purchase;
    if (!qu) return "";
    return item.amount === 1 ? qu.name : (qu.name_plural ?? qu.name);
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/shopping-lists"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-display text-megumi truncate">
            {list.name}
          </h1>
          {list.description && (
            <p className="text-sm text-gray-500 truncate">{list.description}</p>
          )}
        </div>
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Auto-generation buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleGenerate("below-min")}
          disabled={generating !== null}
          className="text-xs"
        >
          {generating === "below-min" ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 mr-1" />
          )}
          Below min stock
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleGenerate("expired")}
          disabled={generating !== null}
          className="text-xs"
        >
          {generating === "expired" ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
          )}
          Expired
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleGenerate("overdue")}
          disabled={generating !== null}
          className="text-xs"
        >
          {generating === "overdue" ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Clock className="h-3.5 w-3.5 mr-1" />
          )}
          Overdue
        </Button>
      </div>

      {/* Stats bar */}
      {stats.total > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
            <span>
              {stats.done} of {stats.total} done
            </span>
            {stats.done > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearDone}
                className="text-gray-500 h-auto py-1"
              >
                <ListChecks className="h-3.5 w-3.5 mr-1" />
                Clear done
              </Button>
            )}
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-megumi rounded-full transition-all"
              style={{
                width: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Grouping toggle */}
      {items.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-500 shrink-0">Group by:</span>
          <div className="flex gap-1">
            <button
              onClick={() => handleGroupByChange("none")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                groupBy === "none"
                  ? "bg-megumi text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              None
            </button>
            <button
              onClick={() => handleGroupByChange("aisle")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                groupBy === "aisle"
                  ? "bg-megumi text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Tags className="h-3 w-3" />
              Aisle
            </button>
            <button
              onClick={() => handleGroupByChange("store")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                groupBy === "store"
                  ? "bg-megumi text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Store className="h-3 w-3" />
              Store
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <ListChecks className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No items yet</p>
          <p className="text-sm mt-1">Add products or freeform items to this list</p>
          <Button
            onClick={() => setShowAddDialog(true)}
            size="sm"
            className="mt-4"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
        </div>
      )}

      {/* Item list */}
      {items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {/* Ungrouped view */}
          {groupBy === "none" && (
            <SortableContext
              items={undoneItems.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {undoneItems.map((item) => (
                  <SortableItem key={item.id} id={item.id}>
                    {({ attributes, listeners, isDragging }) => (
                      <ItemRow
                        item={item}
                        isDragging={isDragging}
                        dragAttributes={attributes}
                        dragListeners={listeners}
                        onToggleDone={handleToggleDone}
                        onAmountChange={handleAmountChange}
                        onDelete={handleDelete}
                        getItemLabel={getItemLabel}
                        getUnitLabel={getUnitLabel}
                        stockEntries={stockEntries}
                      />
                    )}
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          )}

          {/* Grouped view */}
          {groupBy !== "none" && groupedUndoneItems && (
            <div className="space-y-4">
              {groupedUndoneItems.map(([groupKey, group]) => {
                const isCollapsed = collapsedGroups.has(groupKey);
                return (
                  <div key={groupKey}>
                    <button
                      onClick={() => toggleGroupCollapsed(groupKey)}
                      className="flex items-center gap-2 w-full text-left mb-2 group"
                    >
                      <ChevronRight
                        className={`h-4 w-4 text-gray-400 transition-transform ${
                          isCollapsed ? "" : "rotate-90"
                        }`}
                      />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-megumi">
                        {group.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({group.items.length})
                      </span>
                    </button>
                    {!isCollapsed && (
                      <SortableContext
                        items={group.items.map((i) => i.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2 ml-6">
                          {group.items.map((item) => (
                            <SortableItem key={item.id} id={item.id}>
                              {({ attributes, listeners, isDragging }) => (
                                <ItemRow
                                  item={item}
                                  isDragging={isDragging}
                                  dragAttributes={attributes}
                                  dragListeners={listeners}
                                  onToggleDone={handleToggleDone}
                                  onAmountChange={handleAmountChange}
                                  onDelete={handleDelete}
                                  getItemLabel={getItemLabel}
                                  getUnitLabel={getUnitLabel}
                                  stockEntries={stockEntries}
                                />
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
          )}

          {/* Done items */}
          {doneItems.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Done ({doneItems.length})
              </h3>
              <div className="space-y-2">
                {doneItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-100 p-3 opacity-60"
                  >
                    <div className="w-4" />
                    <button
                      onClick={() => handleToggleDone(item)}
                      className="w-5 h-5 rounded border-2 border-megumi bg-megumi/10 flex items-center justify-center shrink-0"
                    >
                      <Check className="h-3 w-3 text-megumi" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm line-through text-gray-500 truncate">
                        {getItemLabel(item)}
                      </span>
                    </div>
                    <span className="text-sm text-gray-400 shrink-0 tabular-nums">
                      {item.amount} {getUnitLabel(item)}
                    </span>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DndContext>
      )}

      {/* Add Item Dialog */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            resetAddForm();
            setShowAddDialog(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
          </DialogHeader>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-2">
            <Button
              variant={addMode === "product" ? "default" : "outline"}
              size="sm"
              onClick={() => setAddMode("product")}
              className="flex-1"
            >
              <Package className="h-4 w-4 mr-1" />
              Product
            </Button>
            <Button
              variant={addMode === "freeform" ? "default" : "outline"}
              size="sm"
              onClick={() => setAddMode("freeform")}
              className="flex-1"
            >
              <StickyNote className="h-4 w-4 mr-1" />
              Freeform
            </Button>
          </div>

          <form onSubmit={handleAdd} className="space-y-4">
            {addMode === "product" ? (
              <>
                {/* Product search + select */}
                <div>
                  <Label htmlFor="product-search">Product</Label>
                  <Input
                    id="product-search"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search products..."
                    autoFocus
                  />
                  {productSearch.trim() && filteredProducts.length > 0 && !selectedProductId && (
                    <div className="mt-1 max-h-40 overflow-y-auto border rounded-md bg-white">
                      {filteredProducts.slice(0, 10).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            handleProductSelect(p.id);
                            setProductSearch(p.name);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0"
                        >
                          {p.name}
                          {p.qu_purchase && (
                            <span className="text-gray-400 ml-2">
                              ({p.qu_purchase.name})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedProductId && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm text-megumi font-medium">
                        {products.find((p) => p.id === selectedProductId)?.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProductId("");
                          setProductSearch("");
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setAmount(Math.max(0.25, amount - 1))}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Input
                      id="amount"
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={amount}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 1)}
                      className="w-20 text-center"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setAmount(amount + 1)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    {selectedQuId && (
                      <span className="text-sm text-gray-500">
                        {quantityUnits.find((q) => q.id === selectedQuId)?.name}
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Freeform note */}
                <div>
                  <Label htmlFor="freeform-note">Item name</Label>
                  <Input
                    id="freeform-note"
                    value={freeformNote}
                    onChange={(e) => setFreeformNote(e.target.value)}
                    placeholder="e.g. Bread rolls from the bakery"
                    required
                    autoFocus
                  />
                </div>

                {/* Amount */}
                <div>
                  <Label htmlFor="freeform-amount">Amount</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() =>
                        setFreeformAmount(Math.max(0.25, freeformAmount - 1))
                      }
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Input
                      id="freeform-amount"
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={freeformAmount}
                      onChange={(e) =>
                        setFreeformAmount(parseFloat(e.target.value) || 1)
                      }
                      className="w-20 text-center"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setFreeformAmount(freeformAmount + 1)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Unit (optional) */}
                <div>
                  <Label htmlFor="freeform-unit">Unit (optional)</Label>
                  <Select
                    value={freeformQuId}
                    onValueChange={setFreeformQuId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No unit" />
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
              </>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetAddForm();
                  setShowAddDialog(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  saving ||
                  (addMode === "product" && !selectedProductId) ||
                  (addMode === "freeform" && !freeformNote.trim())
                }
              >
                {saving ? "Adding..." : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </>
  );
}
