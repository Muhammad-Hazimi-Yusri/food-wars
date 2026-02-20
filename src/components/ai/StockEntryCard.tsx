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
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { ParsedStockItem } from "@/types/database";
import { bulkCreateStockEntries } from "@/lib/stock-entry-utils";

export type HouseholdData = {
  products: { id: string; name: string; qu_id_stock: string | null; location_id: string | null; shopping_location_id: string | null }[];
  locations: { id: string; name: string }[];
  quantityUnits: { id: string; name: string; name_plural: string | null }[];
  shoppingLocations: { id: string; name: string }[];
  conversions: { id: string; product_id: string | null; from_qu_id: string; to_qu_id: string; factor: number }[];
};

type Props = {
  items: ParsedStockItem[];
  householdData: HouseholdData | null;
  onSaved: () => void;
};

export function StockEntryCard({ items: initialItems, householdData, onSaved }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const products = householdData?.products ?? [];
  const locations = householdData?.locations ?? [];
  const quantityUnits = householdData?.quantityUnits ?? [];
  const shoppingLocations = householdData?.shoppingLocations ?? [];

  const updateItem = (index: number, updates: Partial<ParsedStockItem>) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const saveableItems = items.filter(
    (item, index) => item.product_id && !savedIndices.has(index)
  );

  const handleSave = async () => {
    if (saveableItems.length === 0 || saving || !householdData) return;

    setSaving(true);
    try {
      const { successCount, savedIndices: newlySaved } = await bulkCreateStockEntries(
        items,
        householdData,
        savedIndices,
      );

      const newSaved = new Set(savedIndices);
      for (const idx of newlySaved) newSaved.add(idx);
      setSavedIndices(newSaved);

      if (successCount > 0) {
        toast.success(
          `Added ${successCount} item${successCount > 1 ? "s" : ""} to stock`
        );
        router.refresh();
        onSaved();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {items.map((item, index) => {
        const isSaved = savedIndices.has(index);

        return (
          <div
            key={index}
            className={`rounded-lg p-2.5 border text-left ${
              isSaved ? "bg-green-50 border-green-200" : "bg-white border-gray-200"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
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
            {!isSaved && (
              <div className="grid grid-cols-2 gap-1.5">
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

                <div className="relative">
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
                    className="text-[11px] h-7 pr-14"
                    placeholder="Price"
                  />
                  {item.qu_id && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 pointer-events-none">
                      /{quantityUnits.find((u) => u.id === item.qu_id)?.name ?? "ea"}
                    </span>
                  )}
                </div>

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

            {!isSaved && !item.product_id && (
              <p className="text-[10px] text-amber-600 mt-1">
                Select a product to save
              </p>
            )}
          </div>
        );
      })}

      {/* Save button */}
      {saveableItems.length > 0 && (
        <Button
          onClick={handleSave}
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
            ? "Saving..."
            : `Add ${saveableItems.length} item${saveableItems.length !== 1 ? "s" : ""} to stock`}
        </Button>
      )}
    </div>
  );
}
