"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { Product } from "@/types/database";

export type JournalFilterState = {
  search: string;
  product: string;
  transactionType: string;
  dateFrom: string;
  dateTo: string;
};

export const INITIAL_JOURNAL_FILTERS: JournalFilterState = {
  search: "",
  product: "all",
  transactionType: "all",
  dateFrom: "",
  dateTo: "",
};

const TRANSACTION_TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "consume", label: "Consumed" },
  { value: "spoiled", label: "Spoiled" },
  { value: "product-opened", label: "Opened" },
  { value: "transfer-from", label: "Transferred" },
  { value: "inventory-correction", label: "Corrected" },
  { value: "purchase", label: "Purchased" },
];

type JournalFiltersProps = {
  filters: JournalFilterState;
  onFiltersChange: (filters: JournalFilterState) => void;
  products: Pick<Product, "id" | "name">[];
};

export function hasActiveJournalFilters(filters: JournalFilterState): boolean {
  return (
    filters.search !== "" ||
    filters.product !== "all" ||
    filters.transactionType !== "all" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== ""
  );
}

export function JournalFilters({
  filters,
  onFiltersChange,
  products,
}: JournalFiltersProps) {
  const updateFilter = <K extends keyof JournalFilterState>(
    key: K,
    value: JournalFilterState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange(INITIAL_JOURNAL_FILTERS);
  };

  const active = hasActiveJournalFilters(filters);

  return (
    <div className="bg-white rounded-lg p-4 mb-4 shadow-sm space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search products..."
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Dropdowns + Date range */}
      <div className="flex flex-wrap gap-2">
        {/* Product */}
        <Select
          value={filters.product}
          onValueChange={(v) => updateFilter("product", v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Product" />
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
          onValueChange={(v) => updateFilter("transactionType", v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {TRANSACTION_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date from */}
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => updateFilter("dateFrom", e.target.value)}
          className="w-[150px]"
          aria-label="From date"
        />

        {/* Date to */}
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => updateFilter("dateTo", e.target.value)}
          className="w-[150px]"
          aria-label="To date"
        />

        {/* Clear button */}
        {active && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-gray-500"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
