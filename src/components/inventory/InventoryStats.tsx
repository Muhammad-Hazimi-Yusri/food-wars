"use client";

import { StockEntryWithProduct } from "@/types/database";
import { getExpiryStatus } from "@/lib/inventory-utils";
import { AlertTriangle, Clock, AlertCircle, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

type InventoryStatsProps = {
  entries: StockEntryWithProduct[];
  belowMinStockCount: number;
  onFilterChange?: (filter: string | null) => void;
  activeFilter?: string | null;
};

export function InventoryStats({
  entries,
  belowMinStockCount,
  onFilterChange,
  activeFilter,
}: InventoryStatsProps) {
  const productIds = new Set(entries.map((e) => e.product_id));
  const totalProducts = productIds.size;
  const totalStockEntries = entries.length;
  const totalValue = entries.reduce(
    (sum, e) => sum + (e.price ?? 0) * e.amount,
    0
  );

  // Calculate status counts only (min stock handled by parent)
  const statusCounts = useMemo(() => {
    const counts = { expired: 0, overdue: 0, due_soon: 0, fresh: 0, none: 0 };

    for (const entry of entries) {
      const status = getExpiryStatus(
        entry.best_before_date,
        entry.product?.due_type ?? 1
      );
      counts[status]++;
    }

    return counts;
  }, [entries]);

  const banners = [
    {
      key: "expired",
      count: statusCounts.expired,
      icon: AlertTriangle,
      getText: (n: number) =>
        n === 1 ? "1 product is expired" : `${n} products are expired`,
      bg: "bg-kurokiba",
      activeBg: "ring-2 ring-kurokiba ring-offset-2",
    },
    {
      key: "overdue",
      count: statusCounts.overdue,
      icon: AlertCircle,
      getText: (n: number) =>
        n === 1 ? "1 product is overdue" : `${n} products are overdue`,
      bg: "bg-gray-500",
      activeBg: "ring-2 ring-gray-500 ring-offset-2",
    },
    {
      key: "due_soon",
      count: statusCounts.due_soon,
      icon: Clock,
      getText: (n: number) =>
        n === 1
          ? "1 product is due within the next 5 days"
          : `${n} products are due within the next 5 days`,
      bg: "bg-takumi",
      activeBg: "ring-2 ring-takumi ring-offset-2",
    },
    {
      key: "below_min",
      count: belowMinStockCount,
      icon: TrendingDown,
      getText: (n: number) =>
        n === 1
          ? "1 product is below defined min. stock amount"
          : `${n} products are below defined min. stock amount`,
      bg: "bg-teal-600",
      activeBg: "ring-2 ring-teal-600 ring-offset-2",
    },
  ];

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mb-3">
        <span>
          {totalProducts} {totalProducts === 1 ? "product" : "products"}
        </span>
        <span>•</span>
        <span>
          {totalStockEntries}{" "}
          {totalStockEntries === 1 ? "stock entry" : "stock entries"}
        </span>
        {totalValue > 0 && (
          <>
            <span>•</span>
            <span>£{totalValue.toFixed(2)} total value</span>
          </>
        )}
      </div>

      {/* Warning banners */}
      <div className="flex flex-wrap gap-2">
        {banners.map((banner) => {
          const isActive = activeFilter === banner.key;
          const Icon = banner.icon;

          return (
            <button
              key={banner.key}
              onClick={() => onFilterChange?.(isActive ? null : banner.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded text-white text-xs font-medium transition-all",
                banner.bg,
                isActive && banner.activeBg,
                banner.count === 0 && "opacity-50"
              )}
              disabled={banner.count === 0}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{banner.getText(banner.count)}</span>
              <span className="sm:hidden">{banner.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}