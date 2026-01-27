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
import { Location, ProductGroup } from "@/types/database";

export type FilterState = {
  search: string;
  location: string;
  productGroup: string;
  status: string;
};

type StockFiltersProps = {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  locations: Location[];
  productGroups: ProductGroup[];
};

export function StockFilters({
  filters,
  onFiltersChange,
  locations,
  productGroups,
}: StockFiltersProps) {
  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: "",
      location: "all",
      productGroup: "all",
      status: "all",
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.location !== "all" ||
    filters.productGroup !== "all" ||
    filters.status !== "all";

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

      {/* Dropdowns */}
      <div className="flex flex-wrap gap-2">
        {/* Location */}
        <Select
          value={filters.location}
          onValueChange={(v) => updateFilter("location", v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Location" />
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

        {/* Product Group */}
        <Select
          value={filters.productGroup}
          onValueChange={(v) => updateFilter("productGroup", v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Product group" />
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

        {/* Status */}
        <Select
          value={filters.status}
          onValueChange={(v) => updateFilter("status", v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="expiring">Due soon</SelectItem>
            <SelectItem value="fresh">Fresh</SelectItem>
            <SelectItem value="none">No expiry date</SelectItem>
            <SelectItem value="below_min">Below min stock</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear button */}
        {hasActiveFilters && (
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