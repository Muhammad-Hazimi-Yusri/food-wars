"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight, ImageIcon } from "lucide-react";
import { StockEntryWithProduct } from "@/types/database";
import { getExpiryStatus, getExpiryLabel } from "@/lib/inventory-utils";
import { getProductPictureSignedUrl } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";
import { ProductDetailModal } from "./ProductDetailModal";

type MobileStockListProps = {
  entries: StockEntryWithProduct[];
};

type AggregatedProduct = {
  productId: string;
  productName: string;
  pictureFileName: string | null;
  totalAmount: number;
  openedAmount: number;
  unitName: string;
  unitNamePlural: string;
  worstStatus: "expired" | "overdue" | "due_soon" | "fresh" | "none";
  nextDueDate: string | null;
  nextDueDays: number | null;
  entries: StockEntryWithProduct[];
};

function aggregateByProduct(entries: StockEntryWithProduct[]): AggregatedProduct[] {
  const grouped = entries.reduce((acc, entry) => {
    const pid = entry.product_id;
    if (!acc[pid]) {
      acc[pid] = {
        productId: pid,
        productName: entry.product.name,
        pictureFileName: entry.product.picture_file_name,
        totalAmount: 0,
        openedAmount: 0,
        unitName: entry.product.qu_stock?.name ?? "unit",
        unitNamePlural: entry.product.qu_stock?.name_plural ?? "units",
        worstStatus: "none" as const,
        nextDueDate: null,
        nextDueDays: null,
        entries: [],
      };
    }
    
    acc[pid].totalAmount += entry.amount;
    if (entry.open) acc[pid].openedAmount += entry.amount;
    acc[pid].entries.push(entry);
    
    const status = getExpiryStatus(entry.best_before_date, entry.product?.due_type ?? 1);
    const statusPriority = { expired: 0, overdue: 1, due_soon: 2, fresh: 3, none: 4 };
    if (statusPriority[status] < statusPriority[acc[pid].worstStatus]) {
      acc[pid].worstStatus = status;
    }
    
    if (entry.best_before_date) {
      if (!acc[pid].nextDueDate || entry.best_before_date < acc[pid].nextDueDate) {
        acc[pid].nextDueDate = entry.best_before_date;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(entry.best_before_date);
        acc[pid].nextDueDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
    }
    
    return acc;
  }, {} as Record<string, AggregatedProduct>);
  
  return Object.values(grouped).sort((a, b) => {
    const statusPriority = { expired: 0, overdue: 1, due_soon: 2, fresh: 3, none: 4 };
    if (statusPriority[a.worstStatus] !== statusPriority[b.worstStatus]) {
      return statusPriority[a.worstStatus] - statusPriority[b.worstStatus];
    }
    if (a.nextDueDate && b.nextDueDate) {
      return a.nextDueDate.localeCompare(b.nextDueDate);
    }
    return a.productName.localeCompare(b.productName);
  });
}

function ProductImage({ fileName, name }: { fileName: string | null; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (fileName) {
      getProductPictureSignedUrl(fileName).then(setUrl);
    }
  }, [fileName]);
  
  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        width={48}
        height={48}
        className="h-12 w-12 rounded-lg object-cover"
      />
    );
  }
  
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
      <ImageIcon className="h-5 w-5 text-gray-400" />
    </div>
  );
}

function formatDueDate(date: string | null, days: number | null): string {
  if (!date) return "No expiry";
  if (days === null) return date;
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  if (days <= 7) return `${days} days left`;
  if (days <= 30) return `${Math.ceil(days / 7)} weeks left`;
  return `${Math.ceil(days / 30)} months left`;
}

export function MobileStockList({ entries }: MobileStockListProps) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEntries, setModalEntries] = useState<StockEntryWithProduct[]>([]);
  
  const aggregated = useMemo(() => aggregateByProduct(entries), [entries]);
  
  const handleExpand = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };
  
  const handleOpenModal = (product: AggregatedProduct) => {
    setModalEntries(product.entries);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalEntries([]);
  };
  
  const statusColors = {
    expired: "border-l-kurokiba bg-red-50",
    overdue: "border-l-gray-500 bg-gray-50",
    due_soon: "border-l-takumi bg-amber-50",
    fresh: "border-l-green-500 bg-green-50/50",
    none: "border-l-gray-300 bg-white",
  };

  if (aggregated.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No items in stock. Add a product first, then add stock.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {aggregated.map((product) => {
          const isExpanded = expandedProducts.has(product.productId);
          const hasMultipleBatches = product.entries.length > 1;
          
          return (
            <div
              key={product.productId}
              className={cn(
                "bg-white rounded-lg shadow-sm overflow-hidden border-l-4",
                statusColors[product.worstStatus]
              )}
            >
              {/* Main row */}
              <div className="flex items-center p-3 gap-3">
                {/* Expand button */}
                <button
                  onClick={() => handleExpand(product.productId)}
                  className={cn(
                    "p-1 -ml-1 hover:bg-gray-100 rounded transition-colors",
                    !hasMultipleBatches && "invisible"
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </button>

                {/* Product info (clickable) */}
                <button
                  onClick={() => handleOpenModal(product)}
                  className="flex items-center gap-3 flex-1 text-left min-w-0"
                >
                  <ProductImage fileName={product.pictureFileName} name={product.productName} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{product.productName}</div>
                    <div className="text-sm text-gray-500">
                      {product.totalAmount} {product.totalAmount === 1 ? product.unitName : product.unitNamePlural}
                      {product.openedAmount > 0 && (
                        <span className="text-blue-600 ml-1">
                          ({product.openedAmount} opened)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDueDate(product.nextDueDate, product.nextDueDays)}
                    </div>
                  </div>
                </button>

                {/* Batch count */}
                {hasMultipleBatches && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                    {product.entries.length}
                  </span>
                )}
              </div>
              
              {/* Expanded batches */}
              {isExpanded && (
                <div className="border-t bg-gray-50 divide-y divide-gray-100">
                  {product.entries.map((entry) => {
                    const entryStatus = getExpiryStatus(entry.best_before_date, entry.product?.due_type ?? 1);
                    const entryLabel = getExpiryLabel(entry.best_before_date, entry.product?.due_type ?? 1);
                    
                    return (
                      <div key={entry.id} className="px-3 py-2 pl-12 flex items-center justify-between text-sm">
                        <div>
                          <span className="text-gray-700">
                            {entry.amount} {entry.amount === 1 ? product.unitName : product.unitNamePlural}
                          </span>
                          {entry.open && (
                            <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              opened
                            </span>
                          )}
                          {entry.location && (
                            <span className="ml-1.5 text-gray-400 text-xs">
                              @ {entry.location.name}
                            </span>
                          )}
                        </div>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded",
                          entryStatus === "expired" && "bg-red-100 text-red-700",
                          entryStatus === "overdue" && "bg-gray-200 text-gray-700",
                          entryStatus === "due_soon" && "bg-amber-100 text-amber-700",
                          entryStatus === "fresh" && "bg-green-100 text-green-700",
                          entryStatus === "none" && "bg-gray-100 text-gray-600"
                        )}>
                          {entryLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ProductDetailModal
        entries={modalEntries}
        open={modalOpen}
        onClose={handleCloseModal}
      />
    </>
  );
}