"use client";

import { StockEntryWithProduct } from "@/types/database";
import { getExpiryStatus } from "@/lib/inventory-utils";
import { AlertTriangle, Clock, Leaf, Package } from "lucide-react";
import { cn } from "@/lib/utils";

type InventoryStatsProps = {
  entries: StockEntryWithProduct[];
  onFilterChange?: (filter: string | null) => void;
  activeFilter?: string | null;
};

export function InventoryStats({ entries, onFilterChange, activeFilter }: InventoryStatsProps) {
  const productIds = new Set(entries.map((e) => e.product_id));
  const totalProducts = productIds.size;
  const totalStockEntries = entries.length;
  const totalValue = entries.reduce(
    (sum, e) => sum + (e.price ?? 0) * e.amount,
    0
  );

  const statusCounts = entries.reduce(
    (acc, entry) => {
      const status = getExpiryStatus(entry.best_before_date);
      acc[status]++;
      return acc;
    },
    { expired: 0, expiring: 0, fresh: 0, none: 0 }
  );

  const badges = [
    {
      key: "expired",
      count: statusCounts.expired,
      icon: AlertTriangle,
      label: "expired",
      labelPlural: "expired",
      bg: "bg-kurokiba",
      activeBg: "ring-2 ring-kurokiba ring-offset-2",
    },
    {
      key: "expiring",
      count: statusCounts.expiring,
      icon: Clock,
      label: "due soon",
      labelPlural: "due soon",
      bg: "bg-takumi",
      activeBg: "ring-2 ring-takumi ring-offset-2",
    },
    {
      key: "fresh",
      count: statusCounts.fresh,
      icon: Leaf,
      label: "fresh",
      labelPlural: "fresh",
      bg: "bg-green-600",
      activeBg: "ring-2 ring-green-600 ring-offset-2",
    },
    {
      key: "none",
      count: statusCounts.none,
      icon: Package,
      label: "no date",
      labelPlural: "no date",
      bg: "bg-gray-500",
      activeBg: "ring-2 ring-gray-500 ring-offset-2",
    },
  ];

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mb-3">
        <span>{totalProducts} {totalProducts === 1 ? "product" : "products"}</span>
        <span>•</span>
        <span>{totalStockEntries} {totalStockEntries === 1 ? "stock entry" : "stock entries"}</span>
        {totalValue > 0 && (
          <>
            <span>•</span>
            <span>£{totalValue.toFixed(2)} total value</span>
          </>
        )}
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => {
          const isActive = activeFilter === badge.key;
          const Icon = badge.icon;

          return (
            <button
              key={badge.key}
              onClick={() => onFilterChange?.(isActive ? null : badge.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-sm font-medium transition-all",
                badge.bg,
                isActive && badge.activeBg,
                badge.count === 0 && "opacity-50"
              )}
              disabled={badge.count === 0}
            >
              <span>{badge.count}</span>
              <Icon className="h-3.5 w-3.5" />
              {/* Show label on desktop, hide on mobile */}
              <span className="hidden sm:inline">{badge.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}