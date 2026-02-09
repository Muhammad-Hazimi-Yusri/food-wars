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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { StockEntryWithProduct, Location } from "@/types/database";
import { transferStock, undoTransfer } from "@/lib/stock-actions";

type TransferModalProps = {
  entries: StockEntryWithProduct[] | null;
  locations: Location[];
  onClose: () => void;
  preSelectedEntryId?: string;
};

export function TransferModal({
  entries,
  locations,
  onClose,
  preSelectedEntryId,
}: TransferModalProps) {
  const router = useRouter();
  const [selectedEntryId, setSelectedEntryId] = useState<string>("");
  const [destinationId, setDestinationId] = useState<string>("");
  const [freezeDueDateChoice, setFreezeDueDateChoice] = useState<"keep" | "extend">("keep");
  const [manualDueDate, setManualDueDate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = entries !== null && entries.length > 0;
  const product = entries?.[0]?.product;

  // Resolve selected entry
  const resolvedEntryId = preSelectedEntryId ?? selectedEntryId;
  const selectedEntry = entries?.find((e) => e.id === resolvedEntryId) ?? null;
  const autoSelected = entries?.length === 1;

  // Auto-select if only one entry
  const effectiveEntry = autoSelected ? entries![0] : selectedEntry;

  // Build location map for freezer lookups
  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations]
  );

  const sourceLocation = effectiveEntry?.location_id
    ? locationMap.get(effectiveEntry.location_id)
    : null;
  const destLocation = destinationId ? locationMap.get(destinationId) : null;

  // Available destinations: all active locations except current
  const destinationOptions = useMemo(() => {
    if (!effectiveEntry) return locations;
    return locations.filter((l) => l.id !== effectiveEntry.location_id);
  }, [locations, effectiveEntry]);

  // Freezer/thaw detection
  const sourceIsFreezer = sourceLocation?.is_freezer ?? false;
  const destIsFreezer = destLocation?.is_freezer ?? false;
  const isFreezing = !sourceIsFreezer && destIsFreezer;
  const isThawing = sourceIsFreezer && !destIsFreezer;

  // Compute freezing candidate date
  const freezingDate = useMemo(() => {
    if (!product || !isFreezing || product.default_due_days_after_freezing <= 0) return null;
    const d = new Date();
    d.setDate(d.getDate() + product.default_due_days_after_freezing);
    return d.toISOString().split("T")[0];
  }, [product, isFreezing]);

  // Show freeze choice when moving to freezer and product has freezing days
  const showFreezeChoice = isFreezing && freezingDate !== null;

  // Show manual date input when freezing but no configured days
  const showFreezingManualInput = isFreezing && freezingDate === null;

  // Thawing preview (always replace)
  const thawingDate = useMemo(() => {
    if (!product || !isThawing || product.default_due_days_after_thawing <= 0 || !effectiveEntry) return null;
    const d = new Date();
    d.setDate(d.getDate() + product.default_due_days_after_thawing);
    const candidate = d.toISOString().split("T")[0];
    return candidate !== effectiveEntry.best_before_date ? candidate : null;
  }, [product, isThawing, effectiveEntry]);

  // Show manual date input when thawing but no configured days
  const showThawingManualInput = isThawing && !thawingDate && product !== undefined && (product.default_due_days_after_thawing ?? 0) <= 0;

  const showFreezerWarning =
    product?.should_not_be_frozen && destIsFreezer;

  const handleClose = () => {
    setSelectedEntryId("");
    setDestinationId("");
    setFreezeDueDateChoice("keep");
    setManualDueDate("");
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!effectiveEntry) {
      setError("Select a stock entry");
      return;
    }
    if (!destinationId) {
      setError("Select a destination");
      return;
    }

    setSubmitting(true);
    const result = await transferStock(
      effectiveEntry,
      destinationId,
      sourceIsFreezer,
      destIsFreezer,
      {
        useFreezingDueDate: freezeDueDateChoice === "extend",
        manualDueDate: manualDueDate || undefined,
      }
    );
    setSubmitting(false);

    if (result.success) {
      const destName = destLocation?.name ?? "new location";
      handleClose();
      router.refresh();

      if (result.warning) {
        toast.warning(result.warning);
      }

      toast(`Transferred ${product!.name} to ${destName}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await undoTransfer(result.correlationId!);
            if (undo.success) {
              router.refresh();
            } else {
              toast.error(undo.error ?? "Failed to undo");
            }
          },
        },
      });
    } else {
      setError(result.error ?? "Failed to transfer");
    }
  };

  if (!open || !product) return null;

  const unitName = product.qu_stock?.name ?? "unit";
  const unitNamePlural = product.qu_stock?.name_plural ?? "units";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Transfer {product.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Entry selector (only when multiple entries and no pre-selection) */}
          {!autoSelected && !preSelectedEntryId && (
            <div className="space-y-2">
              <Label>Stock entry</Label>
              <Select value={selectedEntryId} onValueChange={setSelectedEntryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select entry..." />
                </SelectTrigger>
                <SelectContent>
                  {entries!.map((entry) => {
                    const locName =
                      locationMap.get(entry.location_id ?? "")?.name ??
                      "No location";
                    return (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.amount}{" "}
                        {entry.amount === 1 ? unitName : unitNamePlural} @{" "}
                        {locName}
                        {entry.open ? " (opened)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Current location display */}
          {effectiveEntry && (
            <div className="text-sm text-gray-500">
              From:{" "}
              <span className="font-medium text-gray-700">
                {sourceLocation?.name ?? "No location"}
                {sourceIsFreezer && (
                  <Snowflake className="inline h-3.5 w-3.5 ml-1 text-blue-500" />
                )}
              </span>
            </div>
          )}

          {/* Destination selector */}
          <div className="space-y-2">
            <Label>Move to</Label>
            <Select value={destinationId} onValueChange={setDestinationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination..." />
              </SelectTrigger>
              <SelectContent>
                {destinationOptions.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                    {loc.is_freezer ? " \u2744" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Should not be frozen — blocks transfer */}
          {showFreezerWarning && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>This product should not be frozen. Pick a different destination.</span>
            </div>
          )}

          {/* Freezing: due date choice (when configured days exist) */}
          {showFreezeChoice && !showFreezerWarning && effectiveEntry && (
            <fieldset className="rounded-md bg-blue-50 border border-blue-200 p-3 space-y-2">
              <legend className="text-sm font-medium text-blue-800 px-1">
                <Snowflake className="inline h-3.5 w-3.5 mr-1" />
                Due date when freezing
              </legend>
              <label className="flex items-center gap-2 text-sm text-blue-800 cursor-pointer">
                <input
                  type="radio"
                  name="freezeDueDate"
                  checked={freezeDueDateChoice === "keep"}
                  onChange={() => setFreezeDueDateChoice("keep")}
                  className="h-4 w-4"
                />
                {effectiveEntry.best_before_date
                  ? `Keep current (${effectiveEntry.best_before_date})`
                  : "No due date"}
              </label>
              <label className="flex items-center gap-2 text-sm text-blue-800 cursor-pointer">
                <input
                  type="radio"
                  name="freezeDueDate"
                  checked={freezeDueDateChoice === "extend"}
                  onChange={() => setFreezeDueDateChoice("extend")}
                  className="h-4 w-4"
                />
                Use freezer shelf life ({freezingDate})
              </label>
            </fieldset>
          )}

          {/* Freezing: manual date input (when no configured days) */}
          {showFreezingManualInput && !showFreezerWarning && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 space-y-2">
              <div className="flex items-start gap-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>No freezer shelf life is configured for this product</span>
              </div>
              <div className="space-y-1">
                <Label className="text-sm text-amber-800">Due date after freezing</Label>
                <Input
                  type="date"
                  value={manualDueDate}
                  onChange={(e) => setManualDueDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Thawing: due date preview (when configured days exist) */}
          {thawingDate && effectiveEntry && (
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
              <Snowflake className="inline h-3.5 w-3.5 mr-1" />
              Thawing — due date will change to{" "}
              <span className="font-medium">{thawingDate}</span>
              {effectiveEntry.best_before_date && (
                <span className="text-blue-600">
                  {" "}
                  (was {effectiveEntry.best_before_date})
                </span>
              )}
            </div>
          )}

          {/* Thawing: manual date input (when no configured days) */}
          {showThawingManualInput && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 space-y-2">
              <div className="flex items-start gap-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>No thawing shelf life is configured for this product</span>
              </div>
              <div className="space-y-1">
                <Label className="text-sm text-amber-800">Due date after thawing</Label>
                <Input
                  type="date"
                  value={manualDueDate}
                  onChange={(e) => setManualDueDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !effectiveEntry || !destinationId || !!showFreezerWarning}>
              {submitting ? "Transferring..." : "Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
