"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight, ImageIcon } from "lucide-react";
import { StockEntryWithProduct } from "@/types/database";
import { getExpiryStatus, getExpiryLabel } from "@/lib/inventory-utils";
import { getProductPictureSignedUrl } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";
import { ProductDetailModal } from "./ProductDetailModal";

type DesktopStockTableProps = {
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
        width={40}
        height={40}
        className="h-10 w-10 rounded object-cover"
      />
    );
  }
  
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100">
      <ImageIcon className="h-4 w-4 text-gray-400" />
    </div>
  );
}

function formatDueDate(date: string | null, days: number | null): string {
  if (!date) return "—";
  const formatted = new Date(date).toLocaleDateString("en-CA");
  if (days === null) return formatted;
  
  let daysText = "";
  if (days < 0) {
    daysText = `${Math.abs(days)}d overdue`;
  } else if (days === 0) {
    daysText = "today";
  } else {
    daysText = `${days}d`;
  }
  
  return `${formatted}\n${daysText}`;
}

export function DesktopStockTable({ entries }: DesktopStockTableProps) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEntries, setModalEntries] = useState<StockEntryWithProduct[]>([]);
  
  const aggregated = useMemo(() => aggregateByProduct(entries), [entries]);
  
  const handleExpand = (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
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
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="w-10"></th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Product</th>
              <th className="text-right py-3 px-4 font-medium text-gray-700">Amount</th>
              <th className="text-right py-3 px-4 font-medium text-gray-700">Next Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {aggregated.map((product) => {
              const isExpanded = expandedProducts.has(product.productId);
              const hasMultipleBatches = product.entries.length > 1;
              
              return (
                <tr key={product.productId} className="group">
                  <td colSpan={4} className="p-0">
                    {/* Main row */}
                    <div
                      className={cn(
                        "flex items-center border-l-4 cursor-pointer hover:bg-gray-50 transition-colors",
                        statusColors[product.worstStatus]
                      )}
                      onClick={() => handleOpenModal(product)}
                    >
                      {/* Expand button */}
                      <button
                        onClick={(e) => handleExpand(e, product.productId)}
                        className={cn(
                          "p-3 hover:bg-gray-100 transition-colors",
                          !hasMultipleBatches && "invisible"
                        )}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                      
                      {/* Product info */}
                      <div className="flex items-center gap-3 flex-1 py-2">
                        <ProductImage fileName={product.pictureFileName} name={product.productName} />
                        <span className="font-medium">{product.productName}</span>
                      </div>
                      
                      {/* Amount */}
                      <div className="text-right px-4 py-2">
                        <div>
                          {product.totalAmount} {product.totalAmount === 1 ? product.unitName : product.unitNamePlural}
                        </div>
                        {product.openedAmount > 0 && (
                          <div className="text-xs text-blue-600">
                            {product.openedAmount} opened
                          </div>
                        )}
                      </div>
                      
                      {/* Due date */}
                      <div className="text-right px-4 py-2 whitespace-pre-line text-sm">
                        {formatDueDate(product.nextDueDate, product.nextDueDays)}
                      </div>
                    </div>
                    
                    {/* Expanded batches */}
                    {isExpanded && (
                      <div className="bg-gray-50 border-t divide-y divide-gray-100">
                        {product.entries.map((entry) => {
                          const entryStatus = getExpiryStatus(entry.best_before_date, entry.product?.due_type ?? 1);
                          const entryLabel = getExpiryLabel(entry.best_before_date, entry.product?.due_type ?? 1);
                          
                          return (
                            <div key={entry.id} className="flex items-center py-2 px-4 pl-14 text-sm">
                              <div className="flex-1">
                                <span className="text-gray-700">
                                  {entry.amount} {entry.amount === 1 ? product.unitName : product.unitNamePlural}
                                </span>
                                {entry.open && (
                                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                    opened
                                  </span>
                                )}
                                {entry.location && (
                                  <span className="ml-2 text-gray-400 text-xs">
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ProductDetailModal
        entries={modalEntries}
        open={modalOpen}
        onClose={handleCloseModal}
      />
    </>
  );
}