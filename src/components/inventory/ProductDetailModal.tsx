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
import {
  ImageIcon,
  MapPin,
  Package,
  Calendar,
  Trash2,
} from "lucide-react";
import { StockEntryWithProduct } from "@/types/database";
import { getExpiryStatus, getExpiryLabel } from "@/lib/inventory-utils";
import { getProductPictureSignedUrl } from "@/lib/supabase/storage";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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

  // Get product from entries prop directly (no local state)
  const product = entries[0]?.product;

  // Load product image
  useEffect(() => {
    if (product?.picture_file_name) {
      getProductPictureSignedUrl(product.picture_file_name).then(setImageUrl);
    } else {
      setImageUrl(null);
    }
  }, [product?.picture_file_name]);

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

      // Close modal and refresh
      onClose();
      router.refresh();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete entry");
    } finally {
      setDeleting(null);
    }
  };

  // Don't render if no entries or not open
  if (!open || entries.length === 0 || !product) {
    return null;
  }

  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
  const openedAmount = entries.filter((e) => e.open).reduce((sum, e) => sum + e.amount, 0);
  const totalValue = entries.reduce((sum, e) => sum + (e.price ?? 0) * e.amount, 0);
  const unitName = product.qu_stock?.name ?? "unit";
  const unitNamePlural = product.qu_stock?.name_plural ?? "units";
  const locations = [...new Set(entries.map((e) => e.location?.name).filter(Boolean))];
  const lastPurchased = entries
    .map((e) => e.purchased_date)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  return (
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
            {locations.length > 0 && (
              <p>
                <span className="text-gray-500">Location:</span>{" "}
                <span className="font-medium">{locations.join(", ")}</span>
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
                const status = getExpiryStatus(entry.best_before_date);
                const label = getExpiryLabel(entry.best_before_date, product.due_type);

                const statusColors = {
                  expired: "border-l-kurokiba bg-red-50",
                  expiring: "border-l-takumi bg-amber-50",
                  fresh: "border-l-green-500 bg-green-50",
                  none: "border-l-gray-300 bg-gray-50",
                };

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "border border-l-4 rounded-lg p-3",
                      statusColors[status]
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">
                            {entry.amount} {entry.amount === 1 ? unitName : unitNamePlural}
                          </span>
                          {entry.open && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              opened
                            </span>
                          )}
                        </div>

                        {entry.location && (
                          <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{entry.location.name}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{label}</span>
                        </div>

                        {entry.price && (
                          <div className="mt-1 text-sm text-gray-500">
                            £{entry.price.toFixed(2)} each
                          </div>
                        )}

                        {entry.note && (
                          <div className="mt-1 text-sm text-gray-500 italic">
                            {entry.note}
                          </div>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={deleting === entry.id}
                      >
                        {deleting === entry.id ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}