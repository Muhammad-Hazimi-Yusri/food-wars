"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { consumeStock, undoConsume, openStock, undoOpen } from "@/lib/stock-actions";
import { toast } from "sonner";
import { StockEntryWithProduct, Product, Location } from "@/types/database";
import { getExpiryStatus, getExpiryLabel } from "@/lib/inventory-utils";
import { getProductPictureSignedUrl } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";
import { ProductDetailModal } from "./ProductDetailModal";
import { ConsumeModal } from "./ConsumeModal";
import { TransferModal } from "./TransferModal";
import { CorrectionModal } from "./CorrectionModal";
import { MoreVertical, Utensils, PackageOpen } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

type MobileStockListProps = {
  entries: StockEntryWithProduct[];
  locations: Location[];
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

export function MobileStockList({ entries, locations, zeroStockProducts = [] }: MobileStockListProps) {
  const router = useRouter();
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEntries, setModalEntries] = useState<StockEntryWithProduct[]>([]);
  const [actionsExpanded, setActionsExpanded] = useState(true);
  const [consuming, setConsuming] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [consumeModalEntries, setConsumeModalEntries] = useState<StockEntryWithProduct[] | null>(null);
  const [transferModalEntries, setTransferModalEntries] = useState<StockEntryWithProduct[] | null>(null);
  const [correctionModalEntries, setCorrectionModalEntries] = useState<StockEntryWithProduct[] | null>(null);

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

  const handleConsume = async (product: AggregatedProduct) => {
    setConsuming(product.productId);
    const amount = product.entries[0].product.quick_consume_amount;
    const result = await consumeStock(product.productId, product.entries, amount);
    setConsuming(null);
    if (result.success) {
      router.refresh();
      const unit = amount === 1 ? product.unitName : product.unitNamePlural;
      toast(`Consumed ${amount} ${unit} of ${product.productName}`, {
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

  const handleConsumeAll = async (product: AggregatedProduct) => {
    setConsuming(product.productId);
    const result = await consumeStock(product.productId, product.entries, product.totalAmount);
    setConsuming(null);
    if (result.success) {
      router.refresh();
      const unit = product.totalAmount === 1 ? product.unitName : product.unitNamePlural;
      toast(`Consumed all ${product.totalAmount} ${unit} of ${product.productName}`, {
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

  const handleOpen = async (product: AggregatedProduct) => {
    setOpening(product.productId);
    const count = product.entries[0].product.quick_open_amount;
    const result = await openStock(product.productId, product.entries, count);
    setOpening(null);
    if (result.success) {
      router.refresh();
      const label = result.opened === 1 ? "entry" : "entries";
      toast(`Opened ${result.opened} ${label} of ${product.productName}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await undoOpen(result.correlationId!);
            if (undo.success) {
              router.refresh();
            } else {
              toast.error(undo.error ?? "Failed to undo");
            }
          },
        },
      });
    } else {
      alert(result.error ?? "Failed to open");
    }
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
    <div className="relative">
    <div className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300">
      <table className="w-full min-w-[500px]">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="px-1 py-1 text-xs font-medium text-gray-500 border-r border-gray-200">Product</th>
            <th className={cn(
              "px-1 py-1 text-xs font-medium text-gray-500 border-r border-gray-200",
              actionsExpanded ? "w-20" : "w-auto"
            )}>Amount</th>
            <th className={cn(
              "px-1 py-1 text-xs font-medium text-gray-500 border-r border-gray-200",
              actionsExpanded ? "w-24" : "w-auto"
            )}>Expires</th>
            <th className="px-1 py-1 bg-gray-100 sticky right-0 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">
              <button
                onClick={() => setActionsExpanded(!actionsExpanded)}
                className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
                title={actionsExpanded ? "Hide actions" : "Show actions"}
              >
                {actionsExpanded ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {aggregated.map((product) => {
            const isExpanded = expandedProducts.has(product.productId);
            const hasMultipleBatches = product.entries.length > 1;

            return (
              <Fragment key={product.productId}>
                <tr
                  className={cn(
                    "border-b border-gray-100",
                    statusColors[product.worstStatus]
                  )}
                >
                  <td className="px-1 py-1 border-r border-gray-100">
                    <div className="flex items-center gap-1">
                      <ProductImage fileName={product.pictureFileName} name={product.productName} />
                      <button
                        onClick={() => handleOpenModal(product)}
                        className="font-medium text-sm text-left hover:text-soma transition-colors break-all min-w-0 w-[80px]"
                      >
                        {product.productName}
                      </button>
                      {hasMultipleBatches && (
                        <button
                          onClick={() => handleExpand(product.productId)}
                          className="text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-1.5 py-0.5 rounded transition-colors"
                        >
                          {product.entries.length}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-1 py-1 text-sm text-gray-600 border-r border-gray-100">
                    {product.totalAmount} {product.totalAmount === 1 ? product.unitName : product.unitNamePlural}
                    {product.openedAmount > 0 && (
                      <span className="text-blue-600 text-xs ml-1">
                        ({product.openedAmount} open)
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-1 text-xs text-gray-500 border-r border-gray-100">
                    {formatDueDate(product.nextDueDate, product.nextDueDays)}
                  </td>
                  <td className="px-1 py-1 bg-white sticky right-0 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                    {actionsExpanded ? (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => handleConsume(product)}
                          disabled={consuming === product.productId}
                          title={`Consume ${product.entries[0]?.product.quick_consume_amount ?? 1}`}
                          className={cn(
                            "h-6 px-1.5 text-xs font-medium rounded bg-green-600 text-white flex items-center gap-0.5",
                            consuming === product.productId
                              ? "opacity-50 cursor-wait"
                              : "hover:bg-green-700 transition-colors"
                          )}
                        >
                          <Utensils className="h-3 w-3" />{product.entries[0]?.product.quick_consume_amount ?? 1}
                        </button>
                        <button
                          onClick={() => handleConsumeAll(product)}
                          disabled={consuming === product.productId}
                          title="Consume All"
                          className={cn(
                            "h-6 px-1.5 text-xs font-medium rounded bg-green-600 text-white flex items-center gap-0.5",
                            consuming === product.productId
                              ? "opacity-50 cursor-wait"
                              : "hover:bg-green-700 transition-colors"
                          )}
                        >
                          <Utensils className="h-3 w-3" />All
                        </button>
                        <button
                          onClick={() => handleOpen(product)}
                          disabled={opening === product.productId || !product.entries.some(e => !e.open)}
                          title={`Open ${product.entries[0]?.product.quick_open_amount ?? 1}`}
                          className={cn(
                            "h-6 px-1.5 text-xs font-medium rounded bg-takumi text-white flex items-center gap-0.5",
                            opening === product.productId
                              ? "opacity-50 cursor-wait"
                              : !product.entries.some(e => !e.open)
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-takumi/90 transition-colors"
                          )}
                        >
                          <PackageOpen className="h-3 w-3" />{product.entries[0]?.product.quick_open_amount ?? 1}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setConsumeModalEntries(product.entries)}>
                              Consume...
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTransferModalEntries(product.entries)}>
                              Transfer...
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setCorrectionModalEntries(product.entries)}>
                              Correct...
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/products/${product.productId}/edit`}>
                                Edit product
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setConsumeModalEntries(product.entries)}>
                            Consume...
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setTransferModalEntries(product.entries)}>
                            Transfer...
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCorrectionModalEntries(product.entries)}>
                            Correct...
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/products/${product.productId}/edit`}>
                              Edit product
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>

                {/* Expanded batches */}
                {isExpanded &&
                  product.entries.map((entry) => {
                    const entryStatus = getExpiryStatus(entry.best_before_date, entry.product?.due_type ?? 1);
                    const entryLabel = getExpiryLabel(entry.best_before_date, entry.product?.due_type ?? 1);

                    return (
                      <tr key={entry.id} className="bg-gray-50 border-b border-gray-100">
                        <td className="px-2 py-2 pl-16 text-sm text-gray-600">
                          {entry.location?.name ?? "No location"}
                          {entry.open && (
                            <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              opened
                            </span>
                          )}
                        </td>
                        <td className="px-1 py-1 text-sm text-gray-600 border-r border-gray-100">
                          {entry.amount} {entry.amount === 1 ? product.unitName : product.unitNamePlural}
                        </td>
                        <td className="px-2 py-2">
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded",
                              entryStatus === "expired" && "bg-red-100 text-red-700",
                              entryStatus === "overdue" && "bg-gray-200 text-gray-700",
                              entryStatus === "due_soon" && "bg-amber-100 text-amber-700",
                              entryStatus === "fresh" && "bg-green-100 text-green-700",
                              entryStatus === "none" && "bg-gray-100 text-gray-600"
                            )}
                          >
                            {entryLabel}
                          </span>
                        </td>
                        <td className="px-2 py-2 sticky right-0 bg-gray-50 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]"></td>
                      </tr>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>

        {/* Zero stock products (only shown when filtering by below_min) */}
        {zeroStockProducts.map((product) => (
          <tr key={product.id} className="border-b border-gray-100 bg-red-50">
            <td className="px-1 py-1 border-r border-gray-100 border-l-4 border-l-teal-600">
              <div className="flex items-center gap-1">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-100">
                  <ImageIcon className="h-3 w-3 text-gray-400" />
                </div>
                <span className="font-medium text-sm break-all min-w-0 w-[80px]">
                  {product.name}
                </span>
              </div>
            </td>
            <td className="px-1 py-1 text-sm text-red-600 border-r border-gray-100 font-medium">
              0 (min: {product.min_stock_amount})
            </td>
            <td className="px-1 py-1 text-xs text-gray-400 border-r border-gray-100">
              —
            </td>
            <td className="px-1 py-1 bg-white sticky right-0 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">
              {actionsExpanded ? (
                <div className="flex items-center gap-0.5">
                  <button disabled title="Consume 1" className="h-6 px-1.5 text-xs font-medium rounded bg-green-600 text-white opacity-50 cursor-not-allowed flex items-center gap-0.5">
                    <Utensils className="h-3 w-3" />1
                  </button>
                  <button disabled title="Consume All" className="h-6 px-1.5 text-xs font-medium rounded bg-green-600 text-white opacity-50 cursor-not-allowed flex items-center gap-0.5">
                    <Utensils className="h-3 w-3" />All
                  </button>
                  <button disabled title="Open 1" className="h-6 px-1.5 text-xs font-medium rounded bg-takumi text-white opacity-50 cursor-not-allowed flex items-center gap-0.5">
                    <PackageOpen className="h-3 w-3" />1
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
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
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
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
              )}
            </td>
          </tr>
        ))}
      </table>
      </div>
      <div className="absolute right-8 top-0 bottom-2 w-4 bg-gradient-to-l from-gray-200/50 to-transparent pointer-events-none" />
    </div>

    <ProductDetailModal entries={modalEntries} open={modalOpen} onClose={handleCloseModal} />

    <ConsumeModal
      entries={consumeModalEntries}
      onClose={() => setConsumeModalEntries(null)}
    />

    <TransferModal
      entries={transferModalEntries}
      locations={locations}
      onClose={() => setTransferModalEntries(null)}
    />

    <CorrectionModal
      entries={correctionModalEntries}
      onClose={() => setCorrectionModalEntries(null)}
    />
  </>
);
}