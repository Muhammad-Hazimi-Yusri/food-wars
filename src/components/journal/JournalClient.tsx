"use client";

import { useState, useMemo, useCallback } from "react";
import { StockLogWithRelations, Product } from "@/types/database";
import { DesktopJournalTable } from "./DesktopJournalTable";
import { MobileJournalList } from "./MobileJournalList";
import {
  JournalFilters,
  JournalFilterState,
  INITIAL_JOURNAL_FILTERS,
  hasActiveJournalFilters,
} from "./JournalFilters";
import { JournalPagination } from "./JournalPagination";
import { JournalSummary } from "./JournalSummary";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const name = log.product?.name?.toLowerCase() ?? "";
        if (!name.includes(searchLower)) return false;
      }

      if (filters.product !== "all") {
        if (log.product_id !== filters.product) return false;
      }

      if (filters.transactionType !== "all") {
        if (log.transaction_type !== filters.transactionType) return false;
      }

      if (filters.dateFrom) {
        const logDate = log.created_at.slice(0, 10);
        if (logDate < filters.dateFrom) return false;
      }

      if (filters.dateTo) {
        const logDate = log.created_at.slice(0, 10);
        if (logDate > filters.dateTo) return false;
      }

      return true;
    });
  }, [logs, filters]);

  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

  const handleFiltersChange = useCallback((next: JournalFilterState) => {
    setFilters(next);
    setPage(1);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

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
                handleFiltersChange({ ...filters, search: e.target.value })
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
            <Select
              value={filters.product}
              onValueChange={(v) =>
                handleFiltersChange({ ...filters, product: v })
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

            <Select
              value={filters.transactionType}
              onValueChange={(v) =>
                handleFiltersChange({ ...filters, transactionType: v })
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

            <div className="flex gap-2">
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) =>
                  handleFiltersChange({ ...filters, dateFrom: e.target.value })
                }
                className="flex-1"
                aria-label="From date"
              />
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) =>
                  handleFiltersChange({ ...filters, dateTo: e.target.value })
                }
                className="flex-1"
                aria-label="To date"
              />
            </div>

            {hasActiveJournalFilters(filters) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFiltersChange(INITIAL_JOURNAL_FILTERS)}
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
          onFiltersChange={handleFiltersChange}
          products={products}
        />
      </div>

      {/* Tabs: Journal / Summary */}
      <Tabs defaultValue="journal">
        <TabsList className="mb-4">
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="journal">
          {/* Mobile view */}
          <div className="sm:hidden">
            <MobileJournalList logs={paginatedLogs} />
          </div>

          {/* Desktop view */}
          <div className="hidden sm:block">
            <DesktopJournalTable logs={paginatedLogs} />
          </div>

          <JournalPagination
            page={page}
            pageSize={pageSize}
            totalItems={filteredLogs.length}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </TabsContent>

        <TabsContent value="summary">
          <JournalSummary logs={filteredLogs} />
        </TabsContent>
      </Tabs>
    </>
  );
}
