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
import { ImageIcon, Pencil, Trash2 } from "lucide-react";
import { StockEntryWithProduct, Location } from "@/types/database";
import { getExpiryStatus, getExpiryLabel } from "@/lib/inventory-utils";
import { getProductPictureSignedUrl } from "@/lib/supabase/storage";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { EditStockEntryModal } from "./EditStockEntryModal";

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
  const [editingEntry, setEditingEntry] = useState<StockEntryWithProduct | null>(null);

  const product = entries[0]?.product;

  // Load product image
  useEffect(() => {
    if (product?.picture_file_name) {
      getProductPictureSignedUrl(product.picture_file_name).then(setImageUrl);
    } else {
      setImageUrl(null);
    }
  }, [product?.picture_file_name]);

  // Load locations for edit modal
  useEffect(() => {
    if (open) {
      const supabase = createClient();
      supabase
        .from("locations")
        .select("*")
        .eq("active", true)
        .order("name")
        .then(({ data }) => {
          if (data) setLocations(data);
        });
    }
  }, [open]);

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm("Delete this stock entry?")) return;

    setDeleting(entryId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("stock_entries")
        .delete()
        .eq("id", entryId);

      if (error) throw error;

      onClose();
      router.refresh();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete entry");
    } finally {
      setDeleting(null);
    }
  };

  if (!open || entries.length === 0 || !product) {
    return null;
  }

  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
  const openedAmount = entries.filter((e) => e.open).reduce((sum, e) => sum + e.amount, 0);
  const totalValue = entries.reduce((sum, e) => sum + (e.price ?? 0) * e.amount, 0);
  const unitName = product.qu_stock?.name ?? "unit";
  const unitNamePlural = product.qu_stock?.name_plural ?? "units";
  const productLocations = [...new Set(entries.map((e) => e.location?.name).filter(Boolean))];
  const lastPurchased = entries
    .map((e) => e.purchased_date)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  const statusColors: Record<string, string> = {
    expired: "bg-red-100 text-red-700",
    overdue: "bg-gray-200 text-gray-700",
    due_soon: "bg-amber-100 text-amber-700",
    fresh: "bg-green-100 text-green-700",
    none: "bg-gray-100 text-gray-600",
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{product.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image */}
            <div className="flex justify-center">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={product.name}
                  width={200}
                  height={200}
                  className="rounded-lg object-cover max-h-48"
                />
              ) : (
                <div className="h-32 w-32 flex items-center justify-center rounded-lg bg-gray-100">
                  <ImageIcon className="h-12 w-12 text-gray-300" />
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="text-center space-y-1 text-sm">
              <p>
                <span className="text-gray-500">Stock amount:</span>{" "}
                <span className="font-medium">
                  {totalAmount} {totalAmount === 1 ? unitName : unitNamePlural}
                </span>
                {openedAmount > 0 && (
                  <span className="text-blue-600 ml-1">({openedAmount} opened)</span>
                )}
              </p>
              {totalValue > 0 && (
                <p>
                  <span className="text-gray-500">Stock value:</span>{" "}
                  <span className="font-medium">£{totalValue.toFixed(2)}</span>
                </p>
              )}
              {productLocations.length > 0 && (
                <p>
                  <span className="text-gray-500">Location:</span>{" "}
                  <span className="font-medium">{productLocations.join(", ")}</span>
                </p>
              )}
              {lastPurchased && (
                <p>
                  <span className="text-gray-500">Last purchased:</span>{" "}
                  <span className="font-medium">{lastPurchased}</span>
                </p>
              )}
            </div>

            <hr />

            {/* Stock Entries */}
            <div>
              <h3 className="font-medium text-gray-700 mb-2">
                Stock Entries ({entries.length})
              </h3>
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
                          {entry.price && <span>£{entry.price.toFixed(2)}</span>}
                          {entry.note && <span>📝 {entry.note}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
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
                          onClick={() => handleDeleteEntry(entry.id)}
                          disabled={deleting === entry.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
        open={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        onSaved={() => {
          setEditingEntry(null);
          onClose();
        }}
      />
    </>
  );
}