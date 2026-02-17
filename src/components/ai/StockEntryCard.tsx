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
import { createClient } from "@/lib/supabase/client";
import { ParsedStockItem } from "@/types/database";
import { GUEST_HOUSEHOLD_ID } from "@/lib/constants";

type HouseholdData = {
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
  const conversions = householdData?.conversions ?? [];

  /** Convert purchase amount → stock amount using conversion tables */
  const getStockAmount = (item: ParsedStockItem): number => {
    if (!item.product_id || !item.qu_id) return item.amount;

    const product = products.find((p) => p.id === item.product_id);
    if (!product?.qu_id_stock) return item.amount;

    // Already in stock unit — no conversion
    if (item.qu_id === product.qu_id_stock) return item.amount;

    // Product-specific conversion first
    const productConv = conversions.find(
      (c) =>
        c.product_id === product.id &&
        c.from_qu_id === item.qu_id &&
        c.to_qu_id === product.qu_id_stock
    );
    if (productConv) return item.amount * productConv.factor;

    // Global conversion fallback
    const globalConv = conversions.find(
      (c) =>
        c.product_id === null &&
        c.from_qu_id === item.qu_id &&
        c.to_qu_id === product.qu_id_stock
    );
    if (globalConv) return item.amount * globalConv.factor;

    return item.amount;
  };

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
    if (saveableItems.length === 0 || saving) return;

    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const isGuest = user.is_anonymous === true;
      let householdId: string;

      if (isGuest) {
        householdId = GUEST_HOUSEHOLD_ID;
      } else {
        const { data: household } = await supabase
          .from("households")
          .select("id")
          .eq("owner_id", user.id)
          .single();
        if (!household) throw new Error("No household found");
        householdId = household.id;
      }

      let successCount = 0;
      const newSaved = new Set(savedIndices);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.product_id || savedIndices.has(i)) continue;

        const product = products.find((p) => p.id === item.product_id);
        const stockAmount = getStockAmount(item);

        // Convert price to per-stock-unit if a unit conversion was applied
        let finalPrice = item.price;
        if (finalPrice != null && stockAmount !== item.amount && stockAmount > 0) {
          // Price was per-purchase-unit, convert to per-stock-unit
          finalPrice = (finalPrice * item.amount) / stockAmount;
        }

        const { error: insertError } = await supabase
          .from("stock_entries")
          .insert({
            household_id: householdId,
            product_id: item.product_id,
            amount: stockAmount,
            location_id: item.location_id || product?.location_id || null,
            shopping_location_id:
              item.shopping_location_id || product?.shopping_location_id || null,
            best_before_date: item.best_before_date || null,
            price: finalPrice,
            note: item.note || null,
            purchased_date: new Date().toISOString().split("T")[0],
          });

        if (!insertError) {
          successCount++;
          newSaved.add(i);
        }
      }

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
