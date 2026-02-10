"use client";

import { useState, useMemo } from "react";
import { StockLogWithRelations, Product } from "@/types/database";
import { DesktopJournalTable } from "./DesktopJournalTable";
import { MobileJournalList } from "./MobileJournalList";
import {
  JournalFilters,
  JournalFilterState,
  INITIAL_JOURNAL_FILTERS,
  hasActiveJournalFilters,
} from "./JournalFilters";
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

const TRANSACTION_TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "consume", label: "Consumed" },
  { value: "spoiled", label: "Spoiled" },
  { value: "product-opened", label: "Opened" },
  { value: "transfer-from", label: "Transferred" },
  { value: "inventory-correction", label: "Corrected" },
  { value: "purchase", label: "Purchased" },
];

type JournalClientProps = {
  logs: StockLogWithRelations[];
  products: Pick<Product, "id" | "name">[];
};

export function JournalClient({ logs, products }: JournalClientProps) {
  const [filters, setFilters] = useState<JournalFilterState>(INITIAL_JOURNAL_FILTERS);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const name = log.product?.name?.toLowerCase() ?? "";
        if (!name.includes(searchLower)) return false;
      }

      // Product filter
      if (filters.product !== "all") {
        if (log.product_id !== filters.product) return false;
      }

      // Transaction type filter
      if (filters.transactionType !== "all") {
        if (log.transaction_type !== filters.transactionType) return false;
      }

      // Date from filter
      if (filters.dateFrom) {
        const logDate = log.created_at.slice(0, 10);
        if (logDate < filters.dateFrom) return false;
      }

      // Date to filter
      if (filters.dateTo) {
        const logDate = log.created_at.slice(0, 10);
        if (logDate > filters.dateTo) return false;
      }

      return true;
    });
  }, [logs, filters]);

  const activeFilterCount = [
    filters.product !== "all",
    filters.transactionType !== "all",
    filters.dateFrom !== "",
    filters.dateTo !== "",
  ].filter(Boolean).length;

  return (
    <>
      {/* Mobile filters */}
      <div className="sm:hidden mb-4 space-y-2">
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

        {showMobileFilters && (
          <div className="bg-white rounded-lg p-3 shadow-sm space-y-2">
            {/* Product */}
            <Select
              value={filters.product}
              onValueChange={(v) =>
                setFilters((prev) => ({ ...prev, product: v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Transaction type */}
            <Select
              value={filters.transactionType}
              onValueChange={(v) =>
                setFilters((prev) => ({ ...prev, transactionType: v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date range */}
            <div className="flex gap-2">
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
                }
                className="flex-1"
                aria-label="From date"
              />
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, dateTo: e.target.value }))
                }
                className="flex-1"
                aria-label="To date"
              />
            </div>

            {hasActiveJournalFilters(filters) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters(INITIAL_JOURNAL_FILTERS)}
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
        <JournalFilters
          filters={filters}
          onFiltersChange={setFilters}
          products={products}
        />
      </div>

      {/* Mobile view */}
      <div className="sm:hidden">
        <MobileJournalList logs={filteredLogs} />
      </div>

      {/* Desktop view */}
      <div className="hidden sm:block">
        <DesktopJournalTable logs={filteredLogs} />
      </div>
    </>
  );
}
