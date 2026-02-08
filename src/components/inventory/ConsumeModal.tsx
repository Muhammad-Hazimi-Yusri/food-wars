"use client";

import { useState, useMemo } from "react";
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
import { StockEntryWithProduct } from "@/types/database";
import { consumeStock } from "@/lib/stock-actions";

type ConsumeModalProps = {
  entries: StockEntryWithProduct[] | null;
  onClose: () => void;
};

const ALL_LOCATIONS = "__all__";

export function ConsumeModal({ entries, onClose }: ConsumeModalProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [locationId, setLocationId] = useState(ALL_LOCATIONS);
  const [spoiled, setSpoiled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = entries !== null && entries.length > 0;
  const product = entries?.[0]?.product;

  // Derive unique locations from entries
  const locationOptions = useMemo(() => {
    if (!entries) return [];
    const seen = new Map<string, string>();
    for (const entry of entries) {
      if (entry.location_id && entry.location?.name) {
        seen.set(entry.location_id, entry.location.name);
      }
    }
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [entries]);

  // Calculate total for current location filter
  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    if (locationId === ALL_LOCATIONS) return entries;
    return entries.filter((e) => e.location_id === locationId);
  }, [entries, locationId]);

  const maxAmount = filteredEntries.reduce((sum, e) => sum + e.amount, 0);

  const unitName = product?.qu_stock?.name ?? "unit";
  const unitNamePlural = product?.qu_stock?.name_plural ?? "units";

  const handleClose = () => {
    setAmount("");
    setLocationId(ALL_LOCATIONS);
    setSpoiled(false);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (numAmount > maxAmount) {
      setError(`Maximum available: ${maxAmount}`);
      return;
    }

    setSubmitting(true);
    const result = await consumeStock(
      entries![0].product_id,
      filteredEntries,
      numAmount,
      { spoiled }
    );
    setSubmitting(false);

    if (result.success) {
      handleClose();
      router.refresh();
    } else {
      setError(result.error ?? "Failed to consume");
    }
  };

  if (!open || !product) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Consume {product.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="consume-amount">
              Amount ({maxAmount} {maxAmount === 1 ? unitName : unitNamePlural} available)
            </Label>
            <Input
              id="consume-amount"
              type="number"
              step="any"
              min="0.01"
              max={maxAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Up to ${maxAmount}`}
              autoFocus
            />
          </div>

          {/* Location filter */}
          {locationOptions.length > 1 && (
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_LOCATIONS}>All locations</SelectItem>
                  {locationOptions.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Spoiled checkbox */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={spoiled}
              onChange={(e) => setSpoiled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Mark as spoiled / wasted
          </label>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Consuming..."
                : spoiled
                  ? "Mark as spoiled"
                  : "Consume"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
