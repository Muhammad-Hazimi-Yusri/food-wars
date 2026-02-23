"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { AlertTriangle } from "lucide-react";
import { StockEntryWithProduct, Location, ShoppingLocation, QuantityUnit } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { undoEditEntry } from "@/lib/stock-actions";
import { toast } from "sonner";
import { getSmartPriceDisplay } from "@/lib/unit-conversions";

type Conversion = {
  id: string;
  product_id: string | null;
  from_qu_id: string;
  to_qu_id: string;
  factor: number;
};

type EditStockEntryModalProps = {
  entry: StockEntryWithProduct | null;
  locations: Location[];
  shoppingLocations: ShoppingLocation[];
  quantityUnits: QuantityUnit[];
  conversions: Conversion[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function EditStockEntryModal({
  entry,
  locations,
  shoppingLocations,
  quantityUnits,
  conversions,
  open,
  onClose,
  onSaved,
}: EditStockEntryModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    amount: 1,
    location_id: "",
    shopping_location_id: "",
    best_before_date: "",
    price: "",
    note: "",
    open: false,
  });
  const [priceType, setPriceType] = useState<"unit" | "total">("unit");
  const [priceUnitId, setPriceUnitId] = useState("");

  // Check if date is in the past
  const isDatePast = formData.best_before_date && new Date(formData.best_before_date) < new Date();

  const product = entry?.product;
  const stockUnitName = product?.qu_stock?.name ?? "unit";
  const stockUnitId = product?.qu_id_stock ?? "";

  // Available units: stock unit + all units with conversions TO the stock unit
  const availableUnits = product
    ? (() => {
        const units: QuantityUnit[] = [];
        if (product.qu_stock) units.push(product.qu_stock);
        const productConversions = conversions.filter(
          (c) =>
            (c.product_id === product.id || c.product_id === null) &&
            c.to_qu_id === product.qu_id_stock
        );
        productConversions.forEach((conv) => {
          const unit = quantityUnits.find((u) => u.id === conv.from_qu_id);
          if (unit && !units.some((u) => u.id === unit.id)) {
            units.push(unit);
          }
        });
        return units;
      })()
    : [];

  // Get conversion factor from selected price unit to stock unit
  const getConversionFactor = () => {
    if (!product || !priceUnitId || priceUnitId === stockUnitId) return 1;
    const productConv = conversions.find(
      (c) =>
        c.product_id === product.id &&
        c.from_qu_id === priceUnitId &&
        c.to_qu_id === stockUnitId
    );
    if (productConv) return productConv.factor;
    const globalConv = conversions.find(
      (c) =>
        c.product_id === null &&
        c.from_qu_id === priceUnitId &&
        c.to_qu_id === stockUnitId
    );
    if (globalConv) return globalConv.factor;
    return 1;
  };

  const conversionFactor = getConversionFactor();
  const selectedUnitName = quantityUnits.find((u) => u.id === priceUnitId)?.name ?? stockUnitName;

  // Convert entered price to per-stock-unit for storage
  const pricePerStockUnit = () => {
    const p = parseFloat(formData.price) || 0;
    if (p === 0) return 0;
    if (priceType === "total") {
      return formData.amount > 0 ? p / formData.amount : 0;
    }
    return p / conversionFactor;
  };

  // Reset form when entry changes
  useEffect(() => {
    if (entry) {
      setFormData({
        amount: entry.amount,
        location_id: entry.location_id ?? "",
        shopping_location_id: entry.shopping_location_id ?? "",
        best_before_date: entry.best_before_date ?? "",
        price: entry.price?.toString() ?? "",
        note: entry.note ?? "",
        open: entry.open ?? false,
      });
      setPriceType("unit");
      setPriceUnitId(entry.product?.qu_id_stock ?? "");
    }
  }, [entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;

    // Capture old values for undo before saving
    const oldValues = {
      amount: entry.amount,
      location_id: entry.location_id,
      shopping_location_id: entry.shopping_location_id,
      best_before_date: entry.best_before_date,
      price: entry.price,
      note: entry.note,
      open: entry.open ?? false,
    };
    const entryId = entry.id;
    const productName = entry.product?.name ?? "item";

    // Calculate final price (always store as per stock unit)
    let finalPrice: number | null = null;
    if (formData.price) {
      finalPrice = pricePerStockUnit();
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("stock_entries")
        .update({
          amount: formData.amount,
          location_id: formData.location_id || null,
          shopping_location_id: formData.shopping_location_id && formData.shopping_location_id !== "none"
            ? formData.shopping_location_id
            : null,
          best_before_date: formData.best_before_date || null,
          price: finalPrice,
          note: formData.note || null,
          open: formData.open,
        })
        .eq("id", entry.id);

      if (error) throw error;

      onSaved();
      onClose();
      router.refresh();
      toast(`Updated entry for ${productName}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await undoEditEntry(entryId, oldValues);
            if (undo.success) {
              router.refresh();
            } else {
              toast.error(undo.error ?? "Failed to undo");
            }
          },
        },
      });
    } catch (err) {
      console.error("Update error:", err);
      alert("Failed to update entry");
    } finally {
      setSaving(false);
    }
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Stock Entry</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product name (read-only) */}
          <div>
            <Label className="text-gray-500">Product</Label>
            <p className="font-medium">{product?.name}</p>
          </div>

          {/* Amount */}
          <div>
            <Label htmlFor="amount">Amount ({stockUnitName})</Label>
            <Input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              value={formData.amount}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  amount: parseFloat(e.target.value) || 0,
                }))
              }
              required
            />
          </div>

          {/* Best before date */}
          <div>
            <Label htmlFor="best_before_date">Due Date</Label>
            <Input
              id="best_before_date"
              type="date"
              value={formData.best_before_date}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  best_before_date: e.target.value,
                }))
              }
            />
            {isDatePast && (
              <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                The given date is earlier than today
              </p>
            )}
          </div>

          {/* Price */}
          <div>
            <Label htmlFor="price">Price</Label>
            <div className="flex items-center gap-4">
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    price: e.target.value,
                  }))
                }
                placeholder="0.00"
                className="flex-1"
              />
              <div className="flex items-center gap-3 text-sm shrink-0">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="editPriceType"
                    checked={priceType === "unit"}
                    onChange={() => setPriceType("unit")}
                    className="h-4 w-4"
                  />
                  Per {selectedUnitName}
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="editPriceType"
                    checked={priceType === "total"}
                    onChange={() => setPriceType("total")}
                    className="h-4 w-4"
                  />
                  Total
                </label>
              </div>
            </div>
            {/* Unit selector when there are multiple units */}
            {priceType === "unit" && availableUnits.length > 1 && (
              <Select value={priceUnitId} onValueChange={setPriceUnitId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Price per..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      Per {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* Conversion hint */}
            {formData.price && parseFloat(formData.price) > 0 && (priceType === "total" || conversionFactor !== 1) && (() => {
              const smart = getSmartPriceDisplay(pricePerStockUnit(), stockUnitName);
              return (
                <p className="text-sm text-gray-500 mt-1">
                  = £{smart.scaledPrice.toFixed(2)} per {smart.displayUnit}
                </p>
              );
            })()}
          </div>

          {/* Store */}
          <div>
            <Label htmlFor="store">Store</Label>
            <Select
              value={formData.shopping_location_id}
              onValueChange={(v) =>
                setFormData((prev) => ({ ...prev, shopping_location_id: v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {shoppingLocations.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location">Location</Label>
            <Select
              value={formData.location_id}
              onValueChange={(v) =>
                setFormData((prev) => ({ ...prev, location_id: v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div>
            <Label htmlFor="note">Note</Label>
            <Input
              id="note"
              value={formData.note}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, note: e.target.value }))
              }
              placeholder="e.g., Buy 1 get 1 free"
            />
          </div>

          {/* Opened toggle */}
          <div className="flex items-center gap-2">
            <input
              id="open"
              type="checkbox"
              checked={formData.open}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, open: e.target.checked }))
              }
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="open" className="font-normal">
              Mark as opened
            </Label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 bg-soma hover:bg-soma/90"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
