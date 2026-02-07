"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronRight, ImageIcon, MoreVertical, Utensils, PackageOpen } from "lucide-react";
import { consumeStock } from "@/lib/stock-actions";
import { StockEntryWithProduct } from "@/types/database";
import { getExpiryStatus, getExpiryLabel } from "@/lib/inventory-utils";
import { getProductPictureSignedUrl } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";
import { ProductDetailModal } from "./ProductDetailModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Product } from "@/types/database";

type DesktopStockTableProps = {
  entries: StockEntryWithProduct[];
  zeroStockProducts?: Product[];
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

export function DesktopStockTable({ entries, zeroStockProducts = [] }: DesktopStockTableProps) {
  const router = useRouter();
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEntries, setModalEntries] = useState<StockEntryWithProduct[]>([]);
  const [consuming, setConsuming] = useState<string | null>(null);
  
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

  const handleConsume = async (product: AggregatedProduct) => {
    setConsuming(product.productId);
    const amount = product.entries[0].product.quick_consume_amount;
    const result = await consumeStock(product.productId, product.entries, amount);
    setConsuming(null);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error ?? "Failed to consume");
    }
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
              <th className="py-3 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {aggregated.map((product) => {
              const isExpanded = expandedProducts.has(product.productId);
              const hasMultipleBatches = product.entries.length > 1;
              
              return (
                <Fragment key={product.productId}>
                  {/* Main row */}
                  <tr className={cn(
                    "border-b hover:bg-gray-50 transition-colors",
                    product.worstStatus === "expired" && "bg-red-50",
                    product.worstStatus === "overdue" && "bg-gray-50",
                    product.worstStatus === "due_soon" && "bg-amber-50",
                    product.worstStatus === "fresh" && "bg-green-50/50",
                  )}>
                    {/* Expand button */}
                    <td className={cn(
                      "p-0 border-l-4",
                      product.worstStatus === "expired" && "border-l-kurokiba",
                      product.worstStatus === "overdue" && "border-l-gray-500",
                      product.worstStatus === "due_soon" && "border-l-takumi",
                      product.worstStatus === "fresh" && "border-l-green-500",
                      product.worstStatus === "none" && "border-l-gray-300",
                    )}>
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
                    </td>
                    
                    {/* Product info */}
                    <td className="py-2 px-4">
                      <button
                        onClick={() => handleOpenModal(product)}
                        className="flex items-center gap-3 text-left hover:text-soma transition-colors"
                      >
                        <ProductImage fileName={product.pictureFileName} name={product.productName} />
                        <span className="font-medium">{product.productName}</span>
                      </button>
                    </td>
                    
                    {/* Amount */}
                    <td className="text-right px-4 py-2">
                      <div>
                        {product.totalAmount} {product.totalAmount === 1 ? product.unitName : product.unitNamePlural}
                      </div>
                      {product.openedAmount > 0 && (
                        <div className="text-xs text-blue-600">
                          {product.openedAmount} opened
                        </div>
                      )}
                    </td>
                    
                    {/* Due date */}
                    <td className="text-right px-4 py-2 whitespace-pre-line text-sm">
                      {formatDueDate(product.nextDueDate, product.nextDueDays)}
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handleConsume(product)}
                          disabled={consuming === product.productId}
                          title={`Consume ${product.entries[0]?.product.quick_consume_amount ?? 1}`}
                          className={cn(
                            "h-7 px-2 text-xs font-medium rounded bg-green-600 text-white flex items-center gap-1",
                            consuming === product.productId
                              ? "opacity-50 cursor-wait"
                              : "hover:bg-green-700 transition-colors"
                          )}
                        >
                          <Utensils className="h-3 w-3" />{product.entries[0]?.product.quick_consume_amount ?? 1}
                        </button>
                        <button
                          disabled
                          title="Consume All"
                          className="h-7 px-2 text-xs font-medium rounded bg-green-600 text-white opacity-50 cursor-not-allowed flex items-center gap-1"
                        >
                          <Utensils className="h-3 w-3" />All
                        </button>
                        <button
                          disabled
                          title="Open 1"
                          className="h-7 px-2 text-xs font-medium rounded bg-takumi text-white opacity-50 cursor-not-allowed flex items-center gap-1"
                        >
                          <PackageOpen className="h-3 w-3" />1
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/products/${product.productId}/edit`}>
                                Edit product
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Expanded batches */}
                  {isExpanded && product.entries.map((entry) => {
                    const entryStatus = getExpiryStatus(entry.best_before_date, entry.product?.due_type ?? 1);
                    const entryLabel = getExpiryLabel(entry.best_before_date, entry.product?.due_type ?? 1);
                    
                    return (
                      <tr key={entry.id} className="bg-gray-50 border-b border-gray-100">
                        <td className="border-l-4 border-l-transparent"></td>
                        <td className="py-2 px-4 pl-14 text-sm text-gray-600">
                          {entry.location?.name ?? "No location"}
                          {entry.open && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              opened
                            </span>
                          )}
                        </td>
                        <td className="text-right px-4 py-2 text-sm text-gray-600">
                          {entry.amount} {entry.amount === 1 ? product.unitName : product.unitNamePlural}
                        </td>
                        <td className="text-right px-4 py-2">
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
                        </td>
                        <td></td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
            {/* Zero stock products (only shown when filtering by below_min) */}
            {zeroStockProducts.map((product) => (
              <tr key={product.id} className="border-b hover:bg-gray-50 transition-colors bg-red-50">
                <td className="p-0 border-l-4 border-l-teal-600">
                  <div className="p-3 invisible">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </td>
                <td className="py-2 px-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100">
                      <ImageIcon className="h-4 w-4 text-gray-400" />
                    </div>
                    <span className="font-medium">{product.name}</span>
                  </div>
                </td>
                <td className="text-right px-4 py-2 text-red-600 font-medium">
                  0 (min: {product.min_stock_amount})
                </td>
                <td className="text-right px-4 py-2 text-sm text-gray-400">
                  —
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <button disabled className="h-7 px-2 text-xs font-medium rounded bg-green-600 text-white opacity-50 cursor-not-allowed flex items-center gap-1">
                      <Utensils className="h-3 w-3" />1
                    </button>
                    <button disabled className="h-7 px-2 text-xs font-medium rounded bg-green-600 text-white opacity-50 cursor-not-allowed flex items-center gap-1">
                      <Utensils className="h-3 w-3" />All
                    </button>
                    <button disabled className="h-7 px-2 text-xs font-medium rounded bg-takumi text-white opacity-50 cursor-not-allowed flex items-center gap-1">
                      <PackageOpen className="h-3 w-3" />1
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/products/${product.id}/edit`}>
                            Edit product
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
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