"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { StockEntryWithProduct, Location } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

type EditStockEntryModalProps = {
  entry: StockEntryWithProduct | null;
  locations: Location[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function EditStockEntryModal({
  entry,
  locations,
  open,
  onClose,
  onSaved,
}: EditStockEntryModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    amount: 1,
    location_id: "",
    best_before_date: "",
    price: "",
    note: "",
    open: false,
  });

  // Reset form when entry changes
  useEffect(() => {
    if (entry) {
      setFormData({
        amount: entry.amount,
        location_id: entry.location_id ?? "",
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

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("stock_entries")
        .update({
          amount: formData.amount,
          location_id: formData.location_id || null,
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

          {/* Best before date */}
          <div>
            <Label htmlFor="best_before_date">Best Before Date</Label>
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
          </div>

          {/* Price */}
          <div>
            <Label htmlFor="price">Price (£)</Label>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={formData.price}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, price: e.target.value }))
              }
              placeholder="0.00"
            />
          </div>

          {/* Note */}
          <div>
            <Label htmlFor="note">Note</Label>
            <Input
              id="note"
              type="text"
              value={formData.note}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, note: e.target.value }))
              }
              placeholder="Optional note"
            />
          </div>

          {/* Opened checkbox */}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}