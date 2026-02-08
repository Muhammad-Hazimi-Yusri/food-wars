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
import { StockEntryWithProduct, Location, ShoppingLocation } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { undoEditEntry } from "@/lib/stock-actions";
import { toast } from "sonner";

type EditStockEntryModalProps = {
  entry: StockEntryWithProduct | null;
  locations: Location[];
  shoppingLocations: ShoppingLocation[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function EditStockEntryModal({
  entry,
  locations,
  shoppingLocations,
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

  // Check if date is in the past
  const isDatePast = formData.best_before_date && new Date(formData.best_before_date) < new Date();

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
          price: formData.price ? parseFloat(formData.price) : null,
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

  const product = entry.product;
  const unitName = product?.qu_stock?.name ?? "unit";

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
            <Label htmlFor="amount">Amount ({unitName})</Label>
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
            <Label htmlFor="price">Price (£ per {unitName})</Label>
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
            />
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