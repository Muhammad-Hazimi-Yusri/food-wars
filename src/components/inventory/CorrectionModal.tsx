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
import { toast } from "sonner";
import { StockEntryWithProduct } from "@/types/database";
import { correctInventory, undoCorrectInventory } from "@/lib/stock-actions";

type CorrectionModalProps = {
  entries: StockEntryWithProduct[] | null;
  onClose: () => void;
};

const ALL_LOCATIONS = "__all__";

export function CorrectionModal({ entries, onClose }: CorrectionModalProps) {
  const router = useRouter();
  const [newAmount, setNewAmount] = useState("");
  const [locationId, setLocationId] = useState(ALL_LOCATIONS);
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

  // Filter entries by selected location
  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    if (locationId === ALL_LOCATIONS) return entries;
    return entries.filter((e) => e.location_id === locationId);
  }, [entries, locationId]);

  const currentAmount = filteredEntries.reduce((sum, e) => sum + e.amount, 0);

  const unitName = product?.qu_stock?.name ?? "unit";
  const unitNamePlural = product?.qu_stock?.name_plural ?? "units";

  const handleClose = () => {
    setNewAmount("");
    setLocationId(ALL_LOCATIONS);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(newAmount);
    if (isNaN(numAmount) || numAmount < 0) {
      setError("Enter a valid amount");
      return;
    }
    if (numAmount === currentAmount) {
      setError("Amount is already correct");
      return;
    }

    setSubmitting(true);
    const result = await correctInventory(
      entries![0].product_id,
      filteredEntries,
      numAmount
    );
    setSubmitting(false);

    if (result.success) {
      const unit = numAmount === 1 ? unitName : unitNamePlural;
      handleClose();
      router.refresh();
      toast(`Corrected ${product!.name}: ${currentAmount} → ${numAmount} ${unit}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await undoCorrectInventory(result.correlationId!);
            if (undo.success) {
              router.refresh();
            } else {
              toast.error(undo.error ?? "Failed to undo");
            }
          },
        },
      });
    } else {
      setError(result.error ?? "Failed to correct inventory");
    }
  };

  if (!open || !product) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Correct {product.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current amount display */}
          <div className="text-sm text-muted-foreground">
            Current stock: <span className="font-medium text-foreground">{currentAmount} {currentAmount === 1 ? unitName : unitNamePlural}</span>
          </div>

          {/* New amount */}
          <div className="space-y-2">
            <Label htmlFor="correction-amount">
              New amount
            </Label>
            <Input
              id="correction-amount"
              type="number"
              step="any"
              min="0"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder={`Currently ${currentAmount}`}
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

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Correcting..." : "Correct"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
