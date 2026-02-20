"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Loader2, X, AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { ParsedStockItem } from "@/types/database";
import { bulkCreateStockEntries } from "@/lib/stock-entry-utils";
import type { HouseholdData } from "./StockEntryCard";

type Props = {
  items: ParsedStockItem[];
  householdData: HouseholdData | null;
  onItemsChange: (items: ParsedStockItem[]) => void;
  onImported: () => void;
  onResolveUnmatched?: () => void;
  /** Raw AI response shown when no items were parsed (debugging aid) */
  rawResponse?: string | null;
  /** Message shown when the items array is empty. Defaults to receipt-specific text. */
  emptyMessage?: string;
};

export function ReceiptReviewTable({
  items,
  householdData,
  onItemsChange,
  onImported,
  onResolveUnmatched,
  rawResponse,
  emptyMessage,
}: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState<Set<number>>(() => new Set(items.map((_, i) => i)));
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const products = householdData?.products ?? [];
  const locations = householdData?.locations ?? [];
  const quantityUnits = householdData?.quantityUnits ?? [];
  const shoppingLocations = householdData?.shoppingLocations ?? [];

  const unmatchedCount = items.filter((item, i) => !item.product_id && !savedIndices.has(i)).length;
  const importableItems = items.filter(
    (item, i) => checked.has(i) && item.product_id && !savedIndices.has(i)
  );

  const toggleCheck = (index: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    const unsavedIndices = items
      .map((_, i) => i)
      .filter((i) => !savedIndices.has(i));
    const allChecked = unsavedIndices.every((i) => checked.has(i));
    if (allChecked) {
      setChecked(new Set());
    } else {
      setChecked(new Set(unsavedIndices));
    }
  };

  const updateItem = (index: number, updates: Partial<ParsedStockItem>) => {
    const updated = [...items];
    updated[index] = { ...updated[index], ...updates };
    onItemsChange(updated);
  };

  const removeItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onItemsChange(updated);
    // Adjust checked and saved indices
    const newChecked = new Set<number>();
    const newSaved = new Set<number>();
    checked.forEach((i) => {
      if (i < index) newChecked.add(i);
      else if (i > index) newChecked.add(i - 1);
    });
    savedIndices.forEach((i) => {
      if (i < index) newSaved.add(i);
      else if (i > index) newSaved.add(i - 1);
    });
    setChecked(newChecked);
    setSavedIndices(newSaved);
  };

  const addBlankItem = () => {
    const newItem: ParsedStockItem = {
      raw: "",
      product_id: null,
      product_name: "",
      amount: 1,
      qu_id: null,
      unit_name: "",
      best_before_date: null,
      shopping_location_id: null,
      store_name: "",
      price: null,
      location_id: null,
      location_name: "",
      note: "",
    };
    onItemsChange([...items, newItem]);
    setChecked((prev) => new Set([...prev, items.length]));
  };

  const handleImport = async () => {
    if (importableItems.length === 0 || saving || !householdData) return;

    setSaving(true);
    try {
      // Build exclude set: unchecked + already saved
      const excludeIndices = new Set<number>();
      items.forEach((_, i) => {
        if (!checked.has(i) || savedIndices.has(i)) excludeIndices.add(i);
      });

      const { successCount, savedIndices: newlySaved } = await bulkCreateStockEntries(
        items,
        householdData,
        excludeIndices,
      );

      const newSaved = new Set(savedIndices);
      for (const idx of newlySaved) newSaved.add(idx);
      setSavedIndices(newSaved);

      if (successCount > 0) {
        toast.success(
          `Added ${successCount} item${successCount > 1 ? "s" : ""} to stock`
        );
        router.refresh();
        onImported();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import");
    } finally {
      setSaving(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-6 space-y-3">
        <p className="text-sm text-gray-500">{emptyMessage ?? "No items found on receipt."}</p>
        {rawResponse && (
          <details className="text-left">
            <summary className="text-[11px] text-gray-400 cursor-pointer hover:text-gray-500">
              Show raw AI response
            </summary>
            <pre className="mt-2 text-[10px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
              {rawResponse}
            </pre>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header bar */}
      <div className="flex items-center justify-between px-1">
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={items.filter((_, i) => !savedIndices.has(i)).every((_, i) => checked.has(i))}
            onChange={toggleAll}
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          Select all
        </label>
        <div className="flex items-center gap-2">
          {unmatchedCount > 0 && onResolveUnmatched && (
            <button
              onClick={onResolveUnmatched}
              className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded hover:bg-amber-100 transition-colors flex items-center gap-1"
            >
              <AlertTriangle className="h-3 w-3" />
              {unmatchedCount} unmatched
            </button>
          )}
          <span className="text-[10px] text-gray-400">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Items */}
      {items.map((item, index) => {
        const isSaved = savedIndices.has(index);
        const isChecked = checked.has(index);

        return (
          <div
            key={index}
            className={`rounded-lg p-2.5 border text-left ${
              isSaved
                ? "bg-green-50 border-green-200"
                : isChecked
                ? "bg-white border-gray-200"
                : "bg-gray-50 border-gray-100 opacity-60"
            }`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                {!isSaved && (
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCheck(index)}
                    className="h-3.5 w-3.5 rounded border-gray-300"
                  />
                )}
                {isSaved ? (
                  <span className="text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                    Added
                  </span>
                ) : item.product_id ? (
                  <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                    Matched
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                    No match
                  </span>
                )}
                <span className="font-medium text-xs">{item.product_name}</span>
                {item.price != null && (
                  <span className="text-[10px] text-gray-400">
                    {"\u00A3"}{item.price.toFixed(2)}
                  </span>
                )}
              </div>
              {!isSaved && (
                <button
                  onClick={() => removeItem(index)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Editable fields */}
            {!isSaved && isChecked && (
              <div className="grid grid-cols-2 gap-1.5">
                {/* Editable product name for unmatched items */}
                {!item.product_id && (
                  <Input
                    value={item.product_name}
                    onChange={(e) =>
                      updateItem(index, { product_name: e.target.value })
                    }
                    className="text-[11px] h-7 col-span-2"
                    placeholder="Product name"
                  />
                )}

                <Select
                  value={item.product_id ?? "unmatched"}
                  onValueChange={(val) =>
                    updateItem(index, {
                      product_id: val === "unmatched" ? null : val,
                      product_name:
                        val === "unmatched"
                          ? item.product_name
                          : (products.find((p) => p.id === val)?.name ?? item.product_name),
                    })
                  }
                >
                  <SelectTrigger className="text-[11px] h-7">
                    <SelectValue placeholder="Product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unmatched">
                      <span className="text-amber-600">-- Select --</span>
                    </SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={item.amount}
                  onChange={(e) =>
                    updateItem(index, { amount: parseFloat(e.target.value) || 1 })
                  }
                  className="text-[11px] h-7"
                  placeholder="Qty"
                />

                <Select
                  value={item.qu_id ?? "none"}
                  onValueChange={(val) =>
                    updateItem(index, { qu_id: val === "none" ? null : val })
                  }
                >
                  <SelectTrigger className="text-[11px] h-7">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">--</SelectItem>
                    {quantityUnits.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  value={item.best_before_date ?? ""}
                  onChange={(e) =>
                    updateItem(index, { best_before_date: e.target.value || null })
                  }
                  className="text-[11px] h-7"
                />

                <Select
                  value={item.shopping_location_id ?? "none"}
                  onValueChange={(val) =>
                    updateItem(index, {
                      shopping_location_id: val === "none" ? null : val,
                    })
                  }
                >
                  <SelectTrigger className="text-[11px] h-7">
                    <SelectValue placeholder="Store" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">--</SelectItem>
                    {shoppingLocations.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.price ?? ""}
                  onChange={(e) =>
                    updateItem(index, {
                      price: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="text-[11px] h-7"
                  placeholder="Price"
                />

                <Select
                  value={item.location_id ?? "none"}
                  onValueChange={(val) =>
                    updateItem(index, {
                      location_id: val === "none" ? null : val,
                    })
                  }
                >
                  <SelectTrigger className="text-[11px] h-7">
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">--</SelectItem>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!isSaved && !item.product_id && isChecked && (
              <p className="text-[10px] text-amber-600 mt-1">
                Select a product to import
              </p>
            )}
          </div>
        );
      })}

      {/* Add item */}
      <Button
        variant="outline"
        size="sm"
        onClick={addBlankItem}
        className="w-full text-xs h-7 gap-1 border-dashed"
      >
        <Plus className="h-3 w-3" />
        Add item
      </Button>

      {/* Import button */}
      {importableItems.length > 0 && (
        <Button
          onClick={handleImport}
          disabled={saving}
          size="sm"
          className="w-full bg-megumi hover:bg-megumi/90 text-xs h-8"
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Check className="h-3 w-3 mr-1" />
          )}
          {saving
            ? "Importing..."
            : `Import ${importableItems.length} item${importableItems.length !== 1 ? "s" : ""} to stock`}
        </Button>
      )}
    </div>
  );
}
