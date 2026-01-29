"use client";

import { useState, useMemo } from "react";
import {
  StockEntryWithProduct,
  Location,
  ProductGroup,
  Product,
} from "@/types/database";
import { getExpiryStatus } from "@/lib/inventory-utils";
import { StockFilters, FilterState } from "./StockFilters";
import { InventoryStats } from "./InventoryStats";
import { MobileStockList } from "./MobileStockList";
import { DesktopStockTable } from "./DesktopStockTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal, X } from "lucide-react";

type StockOverviewClientProps = {
  entries: StockEntryWithProduct[];
  locations: Location[];
  productGroups: ProductGroup[];
  productsWithMinStock: Product[];
};

export function StockOverviewClient({
  entries,
  locations,
  productGroups,
  productsWithMinStock,
}: StockOverviewClientProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    location: "all",
    productGroup: "all",
    status: "all",
  });
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Calculate min stock status per product
  const productMinStockStatus = useMemo(() => {
    const productTotals: Record<string, { total: number; min: number }> = {};

    // First, add all products with min_stock_amount > 0 (starting with 0 stock)
    for (const product of productsWithMinStock) {
      productTotals[product.id] = {
        total: 0,
        min: product.min_stock_amount ?? 0,
      };
    }

    // Then, sum up stock from entries
    for (const entry of entries) {
      const pid = entry.product_id;
      if (!productTotals[pid]) {
        productTotals[pid] = {
          total: 0,
          min: entry.product?.min_stock_amount ?? 0,
        };
      }
      productTotals[pid].total += entry.amount;
    }

    const belowMin: Set<string> = new Set();
    for (const [pid, { total, min }] of Object.entries(productTotals)) {
      if (min > 0 && total < min) {
        belowMin.add(pid);
      }
    }
    return belowMin;
  }, [entries, productsWithMinStock]);

  // Products with min stock but ZERO stock entries (for display when filtering)
  const zeroStockProducts = useMemo(() => {
    const productIdsWithStock = new Set(entries.map(e => e.product_id));
    return productsWithMinStock.filter(p => !productIdsWithStock.has(p.id));
  }, [entries, productsWithMinStock]);
  
  // Apply filters
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const name = entry.product?.name?.toLowerCase() ?? "";
        if (!name.includes(searchLower)) return false;
      }

      // Location filter
      if (filters.location !== "all") {
        if (entry.location_id !== filters.location) return false;
      }

      // Product group filter
      if (filters.productGroup !== "all") {
        if (entry.product?.product_group_id !== filters.productGroup)
          return false;
      }

      // Status filter
      if (filters.status !== "all") {
        if (filters.status === "below_min") {
          if (!productMinStockStatus.has(entry.product_id)) return false;
        } else {
          const status = getExpiryStatus(
            entry.best_before_date,
            entry.product?.due_type ?? 1
          );
          if (status !== filters.status) return false;
        }
      }

      return true;
    });
  }, [entries, filters, productMinStockStatus]);

  // Handle status badge clicks from InventoryStats
  const handleStatsFilter = (status: string | null) => {
    setFilters((prev) => ({
      ...prev,
      status: status ?? "all",
    }));
  };

  const hasActiveFilters =
    filters.search ||
    filters.location !== "all" ||
    filters.productGroup !== "all" ||
    filters.status !== "all";

  const clearFilters = () => {
    setFilters({
      search: "",
      location: "all",
      productGroup: "all",
      status: "all",
    });
  };

  const activeFilterCount = [
    filters.location !== "all",
    filters.productGroup !== "all",
    filters.status !== "all",
  ].filter(Boolean).length;

  return (
    <>
      {/* Stats - uses all entries for counts, but can set filters */}
      <InventoryStats
        entries={entries}
        belowMinStockCount={productMinStockStatus.size}
        onFilterChange={handleStatsFilter}
        activeFilter={filters.status !== "all" ? filters.status : null}
      />

      {/* Mobile filters */}
      <div className="sm:hidden mb-4 space-y-2">
        {/* Search + Filter toggle row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search products..."
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              className="pl-9"
            />
          </div>
          <Button
            variant={showMobileFilters ? "default" : "outline"}
            size="icon"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="relative"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-soma text-white text-xs flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Collapsible filter dropdowns */}
        {showMobileFilters && (
          <div className="bg-white rounded-lg p-3 shadow-sm space-y-2">
            <Select
              value={filters.location}
              onValueChange={(v) =>
                setFilters((prev) => ({ ...prev, location: v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.productGroup}
              onValueChange={(v) =>
                setFilters((prev) => ({ ...prev, productGroup: v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                {productGroups.map((pg) => (
                  <SelectItem key={pg.id} value={pg.id}>
                    {pg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(v) =>
                setFilters((prev) => ({ ...prev, status: v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="due_soon">Due soon</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="below_min">Below min. stock amount</SelectItem>
                <SelectItem value="fresh">In stock</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="w-full text-gray-500"
              >
                <X className="h-4 w-4 mr-1" />
                Clear all filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Desktop filters */}
      <div className="hidden sm:block">
        <StockFilters
          filters={filters}
          onFiltersChange={setFilters}
          locations={locations}
          productGroups={productGroups}
        />
      </div>

      {/* Mobile view */}
      <div className="sm:hidden">
        <MobileStockList 
          entries={filteredEntries}
          zeroStockProducts={filters.status === "below_min" ? zeroStockProducts : []}
        />
      </div>

      {/* Desktop view */}
      <div className="hidden sm:block">
        <DesktopStockTable 
          entries={filteredEntries} 
          zeroStockProducts={filters.status === "below_min" ? zeroStockProducts : []}
        />
      </div>
    </>
  );
}