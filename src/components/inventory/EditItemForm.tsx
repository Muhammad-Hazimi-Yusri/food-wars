"use client";

import { useState } from "react";
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
import { updateInventoryItem } from "@/lib/inventory";
import type { InventoryItem, ItemCategory } from "@/types/database";

type Props = {
  item: InventoryItem;
  onSuccess: () => void;
  onCancel: () => void;
};

export function EditItemForm({ item, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unit, setUnit] = useState(item.unit);
  const [category, setCategory] = useState<ItemCategory>(item.category);
  const [expiryDate, setExpiryDate] = useState(item.expiry_date ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await updateInventoryItem(item.id, {
        name: name.trim(),
        quantity: parseFloat(quantity) || 1,
        unit,
        category,
        expiry_date: expiryDate || null,
      });
      onSuccess();
    } catch (error) {
      console.error("Failed to update item:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">Item name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            min="0"
            step="0.1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="unit">Unit</Label>
          <Input
            id="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as ItemCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fridge">Fridge</SelectItem>
              <SelectItem value="freezer">Freezer</SelectItem>
              <SelectItem value="pantry">Pantry</SelectItem>
              <SelectItem value="spices">Spices</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="expiry">Expiry date</Label>
          <Input
            id="expiry"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}