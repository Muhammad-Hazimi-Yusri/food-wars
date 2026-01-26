"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight, ImageIcon } from "lucide-react";
import { StockEntryWithProduct } from "@/types/database";
import { getExpiryStatus, getExpiryLabel } from "@/lib/inventory-utils";
import { getProductPictureSignedUrl } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";

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
  worstStatus: "expired" | "expiring" | "fresh" | "none";
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
    
    const status = getExpiryStatus(entry.best_before_date);
    const statusPriority = { expired: 0, expiring: 1, fresh: 2, none: 3 };
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
    const statusPriority = { expired: 0, expiring: 1, fresh: 2, none: 3 };
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

function formatDueDate(date: string | null, days: number | null): { date: string; relative: string } {
  if (!date) return { date: "—", relative: "" };
  if (days === null) return { date, relative: "" };
  
  let relative = "";
  if (days < 0) relative = `${Math.abs(days)}d overdue`;
  else if (days === 0) relative = "today";
  else if (days === 1) relative = "tomorrow";
  else if (days <= 7) relative = `in ${days} days`;
  else if (days <= 30) relative = `in ${Math.ceil(days / 7)} weeks`;
  else relative = `in ${Math.ceil(days / 30)} months`;
  
  return { date, relative };
}

export function DesktopStockTable({ entries }: DesktopStockTableProps) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const aggregated = useMemo(() => aggregateByProduct(entries), [entries]);
  
  const toggleExpanded = (productId: string) => {
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
  
  const statusBorderColors = {
    expired: "border-l-kurokiba",
    expiring: "border-l-takumi",
    fresh: "border-l-green-500",
    none: "border-l-gray-300",
  };
  
  const statusRowColors = {
    expired: "bg-red-50 hover:bg-red-100/50",
    expiring: "bg-amber-50 hover:bg-amber-100/50",
    fresh: "bg-green-50/50 hover:bg-green-100/50",
    none: "bg-white hover:bg-gray-50",
  };

  if (aggregated.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        No items in stock. Add a product first, then add stock.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 border-b text-sm font-medium text-gray-600">
        <div className="w-16 flex-shrink-0" />
        <div className="flex-1">Product</div>
        <div className="w-36 text-right">Amount</div>
        <div className="w-48">Next Due Date</div>
      </div>
      
      {/* Rows */}
      <div className="divide-y">
        {aggregated.map((product) => {
          const isExpanded = expandedProducts.has(product.productId);
          const hasMultipleBatches = product.entries.length > 1;
          const dueInfo = formatDueDate(product.nextDueDate, product.nextDueDays);
          
          return (
            <div key={product.productId}>
              {/* Main row */}
              <div
                className={cn(
                  "flex items-center gap-4 px-4 py-3 border-l-4 cursor-pointer transition-colors",
                  statusBorderColors[product.worstStatus],
                  statusRowColors[product.worstStatus]
                )}
                onClick={() => hasMultipleBatches && toggleExpanded(product.productId)}
              >
                {/* Image + Chevron */}
                <div className="w-16 flex-shrink-0 flex items-center gap-2">
                  {hasMultipleBatches ? (
                    isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )
                  ) : (
                    <div className="w-4 flex-shrink-0" />
                  )}
                  <ProductImage fileName={product.pictureFileName} name={product.productName} />
                </div>
                
                {/* Product name */}
                <div className="flex-1 font-medium text-gray-900 truncate">
                  {product.productName}
                </div>
                
                {/* Amount */}
                <div className="w-36 flex-shrink-0 text-right">
                  <div className="font-medium">
                    {product.totalAmount} {product.totalAmount === 1 ? product.unitName : product.unitNamePlural}
                  </div>
                  {product.openedAmount > 0 && (
                    <div className="text-xs text-blue-600">
                      {product.openedAmount} opened
                    </div>
                  )}
                  {hasMultipleBatches && (
                    <div className="text-xs text-gray-400">
                      {product.entries.length} batches
                    </div>
                  )}
                </div>
                
                {/* Due date */}
                <div className="w-48 flex-shrink-0">
                  <div className="text-gray-900">{dueInfo.date}</div>
                  {dueInfo.relative && (
                    <div className="text-xs text-gray-500">{dueInfo.relative}</div>
                  )}
                </div>
              </div>
              
              {/* Expanded batch details */}
              {isExpanded && (
                <div className="bg-gray-50 border-l-4 border-l-gray-200 divide-y divide-gray-200">
                  {product.entries.map((entry) => {
                    const entryStatus = getExpiryStatus(entry.best_before_date);
                    const entryLabel = getExpiryLabel(entry.best_before_date, entry.product.due_type);
                    
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-4 px-4 py-2 text-sm"
                      >
                        {/* Indent space */}
                        <div className="w-16 flex-shrink-0" />
                        
                        {/* Location */}
                        <div className="flex-1 text-gray-600">
                          {entry.location ? `@ ${entry.location.name}` : "—"}
                        </div>
                        
                        {/* Amount */}
                        <div className="w-36 flex-shrink-0 text-right text-gray-700">
                          {entry.amount} {entry.amount === 1 ? product.unitName : product.unitNamePlural}
                          {entry.open && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              opened
                            </span>
                          )}
                        </div>
                        
                        {/* Expiry badge */}
                        <div className="w-48 flex-shrink-0">
                          <span className={cn(
                            "text-xs px-2 py-1 rounded",
                            entryStatus === "expired" && "bg-red-100 text-red-700",
                            entryStatus === "expiring" && "bg-amber-100 text-amber-700",
                            entryStatus === "fresh" && "bg-green-100 text-green-700",
                            entryStatus === "none" && "bg-gray-100 text-gray-600"
                          )}>
                            {entryLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}