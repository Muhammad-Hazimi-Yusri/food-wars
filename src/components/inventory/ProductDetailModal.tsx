"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageIcon, Pencil, Trash2, Utensils, AlertTriangle, ArrowRightLeft, Check, X, RefreshCw, Loader2 } from "lucide-react";
import { StockEntryWithProduct, Location, ShoppingLocation, ProductNutrition } from "@/types/database";
import { getExpiryStatus, getExpiryLabel } from "@/lib/inventory-utils";
import { getProductPictureSignedUrl } from "@/lib/supabase/storage";
import { consumeStock, undoConsume, undoDeleteEntry } from "@/lib/stock-actions";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { EditStockEntryModal } from "./EditStockEntryModal";
import { TransferModal } from "./TransferModal";
import { NutritionLabel } from "./NutritionLabel";
import { NutriScoreBadge } from "./NutriScoreBadge";
import { refetchProductFromOFF, applyOFFUpdates } from "@/lib/product-actions";
import type { OFFProduct } from "@/lib/openfoodfacts";

type ProductDetailModalProps = {
  entries: StockEntryWithProduct[];
  open: boolean;
  onClose: () => void;
};

export function ProductDetailModal({
  entries,
  open,
  onClose,
}: ProductDetailModalProps) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [shoppingLocations, setShoppingLocations] = useState<ShoppingLocation[]>([]);
  const [editingEntry, setEditingEntry] = useState<StockEntryWithProduct | null>(null);
  const [transferringEntry, setTransferringEntry] = useState<StockEntryWithProduct | null>(null);
  const [consumingEntry, setConsumingEntry] = useState<{ id: string; amount: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [nutrition, setNutrition] = useState<ProductNutrition | null>(null);
  const [refetching, setRefetching] = useState(false);
  const [offData, setOffData] = useState<OFFProduct | null>(null);
  const [refetchFlags, setRefetchFlags] = useState({
    updateImage: true,
    updateBrand: true,
    updateNutrition: true,
  });
  const [applying, setApplying] = useState(false);

  const product = entries[0]?.product;

  // Load product image
  useEffect(() => {
    if (product?.picture_file_name) {
      getProductPictureSignedUrl(product.picture_file_name).then(setImageUrl);
    } else {
      setImageUrl(null);
    }
  }, [product?.picture_file_name]);

  // Load locations and stores for edit modal
  useEffect(() => {
    if (open) {
      const supabase = createClient();
      
      // Fetch locations
      supabase
        .from("locations")
        .select("*")
        .eq("active", true)
        .order("name")
        .then(({ data }) => {
          if (data) setLocations(data);
        });

      // Fetch shopping locations (stores)
      supabase
        .from("shopping_locations")
        .select("*")
        .eq("active", true)
        .order("name")
        .then(({ data }) => {
          if (data) setShoppingLocations(data);
        });

      // Fetch nutrition data
      if (product?.id) {
        supabase
          .from("product_nutrition")
          .select("*")
          .eq("product_id", product.id)
          .maybeSingle()
          .then(({ data }) => {
            setNutrition(data);
          });
      }
    }
  }, [open, product?.id]);

  const handleDeleteEntry = async (entry: StockEntryWithProduct) => {
    setDeleting(entry.id);
    try {
      // Capture snapshot before deleting
      const snapshot = {
        household_id: entry.household_id,
        product_id: entry.product_id,
        amount: entry.amount,
        best_before_date: entry.best_before_date,
        purchased_date: entry.purchased_date,
        price: entry.price,
        location_id: entry.location_id,
        shopping_location_id: entry.shopping_location_id,
        open: entry.open,
        opened_date: entry.opened_date,
        stock_id: entry.stock_id,
        note: entry.note,
      };

      const supabase = createClient();
      const { error } = await supabase
        .from("stock_entries")
        .delete()
        .eq("id", entry.id);

      if (error) throw error;

      const unitName = product?.qu_stock?.name ?? "unit";
      const unitNamePlural = product?.qu_stock?.name_plural ?? "units";
      const unit = entry.amount === 1 ? unitName : unitNamePlural;
      onClose();
      router.refresh();
      toast(`Deleted ${entry.amount} ${unit} of ${product?.name}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await undoDeleteEntry(snapshot);
            if (undo.success) {
              router.refresh();
            } else {
              toast.error(undo.error ?? "Failed to undo");
            }
          },
        },
      });
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete entry");
    } finally {
      setDeleting(null);
    }
  };

  const handleConsumeEntry = async (entry: StockEntryWithProduct) => {
    const numAmount = parseFloat(consumingEntry?.amount ?? "");
    if (isNaN(numAmount) || numAmount <= 0 || numAmount > entry.amount) {
      alert(`Enter a valid amount (1-${entry.amount})`);
      return;
    }
    setActionLoading(entry.id);
    const result = await consumeStock(entry.product_id, [entry], numAmount);
    setActionLoading(null);
    setConsumingEntry(null);
    if (result.success) {
      const unitName = product?.qu_stock?.name ?? "unit";
      const unitNamePlural = product?.qu_stock?.name_plural ?? "units";
      const unit = numAmount === 1 ? unitName : unitNamePlural;
      onClose();
      router.refresh();
      toast(`Consumed ${numAmount} ${unit} of ${product?.name}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await undoConsume(result.correlationId!);
            if (undo.success) {
              router.refresh();
            } else {
              toast.error(undo.error ?? "Failed to undo");
            }
          },
        },
      });
    } else {
      alert(result.error ?? "Failed to consume");
    }
  };

  const handleSpoilEntry = async (entry: StockEntryWithProduct) => {
    const unitName = product?.qu_stock?.name ?? "unit";
    const unitNamePlural = product?.qu_stock?.name_plural ?? "units";
    const unit = entry.amount === 1 ? unitName : unitNamePlural;
    setActionLoading(entry.id);
    const result = await consumeStock(entry.product_id, [entry], entry.amount, { spoiled: true });
    setActionLoading(null);
    if (result.success) {
      onClose();
      router.refresh();
      toast(`Marked ${entry.amount} ${unit} of ${product?.name} as spoiled`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await undoConsume(result.correlationId!);
            if (undo.success) {
              router.refresh();
            } else {
              toast.error(undo.error ?? "Failed to undo");
            }
          },
        },
      });
    } else {
      alert(result.error ?? "Failed to mark as spoiled");
    }
  };

  const handleRefetch = async () => {
    if (!product?.id) return;
    setRefetching(true);
    setOffData(null);
    const result = await refetchProductFromOFF(product.id);
    setRefetching(false);
    if (result.success && result.offData) {
      setOffData(result.offData);
      setRefetchFlags({
        updateImage: !!result.offData.imageUrl,
        updateBrand: !!result.offData.brands,
        updateNutrition: !!result.offData.nutriments,
      });
    } else {
      toast.error(result.error ?? "Failed to fetch from OFF");
    }
  };

  const handleApplyUpdates = async () => {
    if (!product?.id || !offData) return;
    setApplying(true);
    const result = await applyOFFUpdates(product.id, offData, refetchFlags);
    setApplying(false);
    if (result.success) {
      toast("Product updated from Open Food Facts");
      setOffData(null);
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to apply updates");
    }
  };

  if (!open || entries.length === 0 || !product) {
    return null;
  }

  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
  const openedAmount = entries.filter((e) => e.open).reduce((sum, e) => sum + e.amount, 0);
  const totalValue = entries.reduce((sum, e) => sum + (e.price ?? 0) * e.amount, 0);
  const unitName = product.qu_stock?.name ?? "unit";
  const unitNamePlural = product.qu_stock?.name_plural ?? unitName + "s";

  const statusColors: Record<string, string> = {
    fresh: "bg-green-100 text-green-700",
    expiring_soon: "bg-amber-100 text-amber-700",
    expired: "bg-red-100 text-red-700",
    overdue: "bg-gray-200 text-gray-700",
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {product.name}
              <NutriScoreBadge grade={nutrition?.nutrition_grade ?? null} />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 ml-auto text-gray-400 hover:text-megumi"
                onClick={handleRefetch}
                disabled={refetching}
                title="Refetch from Open Food Facts"
              >
                {refetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Product Image & Summary */}
            <div className="flex gap-4">
              {/* Image */}
              <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={product.name}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
              </div>

              {/* Summary Stats */}
              <div className="flex-1 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total stock:</span>
                  <span className="font-medium">
                    {totalAmount} {totalAmount === 1 ? unitName : unitNamePlural}
                  </span>
                </div>
                {openedAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Opened:</span>
                    <span>{openedAmount}</span>
                  </div>
                )}
                {totalValue > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total value:</span>
                    <span>£{totalValue.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Batches:</span>
                  <span>{entries.length}</span>
                </div>
              </div>
            </div>

            {/* OFF Refetch Panel */}
            {offData && (
              <div className="rounded-lg border border-megumi/30 bg-megumi/5 p-3 space-y-2">
                <p className="text-sm font-medium text-megumi">
                  Data from Open Food Facts
                </p>
                <div className="space-y-1.5 text-sm">
                  {offData.imageUrl && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={refetchFlags.updateImage}
                        onChange={(e) =>
                          setRefetchFlags((f) => ({
                            ...f,
                            updateImage: e.target.checked,
                          }))
                        }
                      />
                      <span>Update image</span>
                    </label>
                  )}
                  {offData.brands && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={refetchFlags.updateBrand}
                        onChange={(e) =>
                          setRefetchFlags((f) => ({
                            ...f,
                            updateBrand: e.target.checked,
                          }))
                        }
                      />
                      <span>
                        Brand: {product.brand ?? "—"} &rarr; {offData.brands}
                      </span>
                    </label>
                  )}
                  {offData.nutriments && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={refetchFlags.updateNutrition}
                        onChange={(e) =>
                          setRefetchFlags((f) => ({
                            ...f,
                            updateNutrition: e.target.checked,
                          }))
                        }
                      />
                      <span>Update nutrition data</span>
                    </label>
                  )}
                  {!offData.imageUrl &&
                    !offData.brands &&
                    !offData.nutriments && (
                      <p className="text-gray-500">
                        No new data available from OFF.
                      </p>
                    )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={handleApplyUpdates}
                    disabled={
                      applying ||
                      (!refetchFlags.updateImage &&
                        !refetchFlags.updateBrand &&
                        !refetchFlags.updateNutrition)
                    }
                  >
                    {applying ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : null}
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setOffData(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Nutrition */}
            <NutritionLabel nutrition={nutrition} />

            {/* Stock Entries */}
            <div>
              <h4 className="font-medium mb-2">Stock entries</h4>
              <div className="space-y-2">
                {entries.map((entry) => {
                  const status = getExpiryStatus(
                    entry.best_before_date,
                    entry.product?.due_type ?? 1
                  );
                  const expiryLabel = getExpiryLabel(
                    entry.best_before_date,
                    entry.product?.due_type ?? 1
                  );

                  // Get store name
                  const storeName = shoppingLocations.find(
                    (s) => s.id === entry.shopping_location_id
                  )?.name;

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {entry.amount}{" "}
                            {entry.amount === 1 ? unitName : unitNamePlural}
                          </span>
                          {entry.open && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              opened
                            </span>
                          )}
                          <span className={cn("text-xs px-2 py-0.5 rounded", statusColors[status])}>
                            {expiryLabel}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 space-x-2">
                          {entry.location && <span>📍 {entry.location.name}</span>}
                          {storeName && <span>🏪 {storeName}</span>}
                          {entry.price && <span>£{entry.price.toFixed(2)}</span>}
                          {entry.note && <span>📝 {entry.note}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {consumingEntry?.id === entry.id ? (
                          <>
                            <Input
                              type="number"
                              step="any"
                              min="0.01"
                              max={entry.amount}
                              value={consumingEntry.amount}
                              onChange={(e) => setConsumingEntry({ id: entry.id, amount: e.target.value })}
                              className="h-8 w-16 text-xs"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-600 hover:text-green-700"
                              onClick={() => handleConsumeEntry(entry)}
                              disabled={actionLoading === entry.id}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-gray-700"
                              onClick={() => setConsumingEntry(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-green-600"
                              onClick={() => setConsumingEntry({ id: entry.id, amount: String(entry.amount) })}
                              disabled={actionLoading === entry.id}
                              title="Consume"
                            >
                              <Utensils className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-amber-600"
                              onClick={() => handleSpoilEntry(entry)}
                              disabled={actionLoading === entry.id}
                              title="Mark as spoiled"
                            >
                              <AlertTriangle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-indigo-600"
                              onClick={() => setTransferringEntry(entry)}
                              title="Transfer"
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-blue-600"
                              onClick={() => setEditingEntry(entry)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-red-600"
                              onClick={() => handleDeleteEntry(entry)}
                              disabled={deleting === entry.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <EditStockEntryModal
        entry={editingEntry}
        locations={locations}
        shoppingLocations={shoppingLocations}
        open={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        onSaved={() => {
          setEditingEntry(null);
          onClose();
        }}
      />

      {/* Transfer Modal */}
      <TransferModal
        entries={transferringEntry ? [transferringEntry] : null}
        locations={locations}
        preSelectedEntryId={transferringEntry?.id}
        onClose={() => {
          setTransferringEntry(null);
          onClose();
        }}
      />
    </>
  );
}