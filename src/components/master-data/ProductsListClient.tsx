"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ImageIcon,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Settings2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getProductPictureSignedUrl, deleteProductPicture } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";
import { ProductGroup, StockEntryWithProduct, ProductWithRelations as DBProductWithRelations } from "@/types/database";
import { ProductDetailModal } from "@/components/inventory/ProductDetailModal";

type ProductWithRelations = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  picture_file_name: string | null;
  min_stock_amount: number;
  qu_id_stock: string | null;
  qu_id_purchase: string | null;
  location: { id: string; name: string } | null;
  product_group: { id: string; name: string } | null;
  qu_stock: { id: string; name: string; name_plural: string | null } | null;
  qu_purchase: { id: string; name: string; name_plural: string | null } | null;
  shopping_location: { id: string; name: string } | null;
};

type ProductsListClientProps = {
  products: ProductWithRelations[];
  productGroups: ProductGroup[];
};

type SortField = "name" | "location" | "product_group" | "min_stock_amount" | "qu_stock" | "qu_purchase" | "shopping_location";
type SortDirection = "asc" | "desc";
type GroupByField = "none" | "location" | "product_group" | "min_stock_amount" | "qu_stock" | "shopping_location";

type ColumnKey = "picture" | "name" | "location" | "min_stock_amount" | "qu_purchase" | "qu_stock" | "product_group" | "shopping_location";

const ALL_COLUMNS: { key: ColumnKey; label: string; sortField?: SortField; required?: boolean }[] = [
  { key: "picture", label: "Product picture" },
  { key: "name", label: "Name", sortField: "name", required: true },
  { key: "location", label: "Location", sortField: "location" },
  { key: "min_stock_amount", label: "Min. stock amount", sortField: "min_stock_amount" },
  { key: "qu_purchase", label: "Default QU purchase", sortField: "qu_purchase" },
  { key: "qu_stock", label: "QU stock", sortField: "qu_stock" },
  { key: "product_group", label: "Product group", sortField: "product_group" },
  { key: "shopping_location", label: "Default store", sortField: "shopping_location" },
];

const GROUP_BY_OPTIONS: { value: GroupByField; label: string }[] = [
  { value: "none", label: "None" },
  { value: "location", label: "Location" },
  { value: "product_group", label: "Product group" },
  { value: "min_stock_amount", label: "Min. stock amount" },
  { value: "qu_stock", label: "Quantity unit stock" },
  { value: "shopping_location", label: "Default store" },
];

const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = ["picture", "name", "location", "min_stock_amount", "qu_stock", "product_group"];

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

function SortHeader({
  label,
  field,
  currentSort,
  currentDirection,
  onSort,
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentDirection: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentSort === field;

  return (
    <button
      onClick={() => onSort(field)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors text-left",
        isActive && "text-gray-900"
      )}
    >
      <span className="truncate">{label}</span>
      {isActive ? (
        currentDirection === "asc" ? (
          <ChevronUp className="h-3 w-3 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40 flex-shrink-0" />
      )}
    </button>
  );
}

function TableOptionsContent({
  visibleColumns,
  toggleColumn,
  groupBy,
  handleGroupByChange,
  resetTableOptions,
}: {
  visibleColumns: ColumnKey[];
  toggleColumn: (key: ColumnKey) => void;
  groupBy: GroupByField;
  handleGroupByChange: (value: GroupByField) => void;
  resetTableOptions: () => void;
}) {
  const isColumnVisible = (key: ColumnKey) => visibleColumns.includes(key);

  return (
    <div className="space-y-4">
      {/* Column visibility */}
      <div>
        <h4 className="font-medium text-sm mb-2">Show/hide columns</h4>
        <div className="space-y-1">
          {ALL_COLUMNS.map((col) => (
            <label
              key={col.key}
              className={cn(
                "flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-gray-50 cursor-pointer",
                col.required && "opacity-50 cursor-not-allowed"
              )}
            >
              <input
                type="checkbox"
                checked={isColumnVisible(col.key)}
                onChange={() => toggleColumn(col.key)}
                disabled={col.required}
                className="h-4 w-4 rounded border-gray-300"
              />
              {col.label}
            </label>
          ))}
        </div>
      </div>

      {/* Group by */}
      <div>
        <h4 className="font-medium text-sm mb-2">Group by</h4>
        <div className="space-y-1">
          {GROUP_BY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="radio"
                name="groupBy"
                checked={groupBy === opt.value}
                onChange={() => handleGroupByChange(opt.value)}
                className="h-4 w-4 border-gray-300"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Reset button */}
      <div className="pt-2 border-t">
        <Button variant="outline" size="sm" onClick={resetTableOptions} className="w-full">
          Reset
        </Button>
      </div>
    </div>
  );
}

export function ProductsListClient({
  products,
  productGroups,
}: ProductsListClientProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [showFilters, setShowFilters] = useState(false);
  const [showTableOptions, setShowTableOptions] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Group by
  const [groupBy, setGroupBy] = useState<GroupByField>("none");

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);

  // Product detail modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEntries, setModalEntries] = useState<StockEntryWithProduct[]>([]);
  const [modalProduct, setModalProduct] = useState<DBProductWithRelations | null>(null);

  const handleOpenProduct = async (product: ProductWithRelations) => {
    const supabase = createClient();
    const { data: entries } = await supabase
      .from("stock_entries")
      .select("*, product:products(*), location:locations(id, name), shopping_location:shopping_locations(id, name)")
      .eq("product_id", product.id);
    setModalEntries((entries ?? []) as unknown as StockEntryWithProduct[]);
    setModalProduct(product as unknown as DBProductWithRelations);
    setModalOpen(true);
  };

  // Load preferences from localStorage
  useEffect(() => {
    const savedColumns = localStorage.getItem("products-visible-columns");
    if (savedColumns) {
      try {
        setVisibleColumns(JSON.parse(savedColumns));
      } catch {
        // ignore
      }
    }
    const savedGroupBy = localStorage.getItem("products-group-by");
    if (savedGroupBy) {
      setGroupBy(savedGroupBy as GroupByField);
    }
  }, []);

  const toggleColumn = (key: ColumnKey) => {
    const column = ALL_COLUMNS.find((c) => c.key === key);
    if (column?.required) return;

    const newColumns = visibleColumns.includes(key)
      ? visibleColumns.filter((c) => c !== key)
      : [...visibleColumns, key];

    setVisibleColumns(newColumns);
    localStorage.setItem("products-visible-columns", JSON.stringify(newColumns));
  };

  const handleGroupByChange = (value: GroupByField) => {
    setGroupBy(value);
    localStorage.setItem("products-group-by", value);
  };

  const resetTableOptions = () => {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    setGroupBy("none");
    localStorage.removeItem("products-visible-columns");
    localStorage.removeItem("products-group-by");
  };

  const isColumnVisible = (key: ColumnKey) => visibleColumns.includes(key);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Get group value for a product
  const getGroupValue = (product: ProductWithRelations): string => {
    switch (groupBy) {
      case "location":
        return product.location?.name ?? "No location";
      case "product_group":
        return product.product_group?.name ?? "No group";
      case "min_stock_amount":
        return product.min_stock_amount > 0 ? `Min: ${product.min_stock_amount}` : "No minimum";
      case "qu_stock":
        return product.qu_stock?.name ?? "No unit";
      case "shopping_location":
        return product.shopping_location?.name ?? "No store";
      default:
        return "";
    }
  };

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    const result = products.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (groupFilter !== "all" && p.product_group?.id !== groupFilter) {
        return false;
      }
      if (statusFilter === "active" && !p.active) return false;
      if (statusFilter === "inactive" && p.active) return false;
      return true;
    });

    result.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "location":
          aVal = a.location?.name?.toLowerCase() ?? "";
          bVal = b.location?.name?.toLowerCase() ?? "";
          break;
        case "product_group":
          aVal = a.product_group?.name?.toLowerCase() ?? "";
          bVal = b.product_group?.name?.toLowerCase() ?? "";
          break;
        case "min_stock_amount":
          aVal = a.min_stock_amount;
          bVal = b.min_stock_amount;
          break;
        case "qu_stock":
          aVal = a.qu_stock?.name?.toLowerCase() ?? "";
          bVal = b.qu_stock?.name?.toLowerCase() ?? "";
          break;
        case "qu_purchase":
          aVal = a.qu_purchase?.name?.toLowerCase() ?? "";
          bVal = b.qu_purchase?.name?.toLowerCase() ?? "";
          break;
        case "shopping_location":
          aVal = a.shopping_location?.name?.toLowerCase() ?? "";
          bVal = b.shopping_location?.name?.toLowerCase() ?? "";
          break;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [products, search, groupFilter, statusFilter, sortField, sortDirection]);

  // Group products if groupBy is set
  const groupedProducts = useMemo(() => {
    if (groupBy === "none") {
      return [{ groupName: "", products: filteredProducts }];
    }

    const groups: Record<string, ProductWithRelations[]> = {};
    filteredProducts.forEach((product) => {
      const groupName = getGroupValue(product);
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(product);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([groupName, prods]) => ({ groupName, products: prods }));
  }, [filteredProducts, groupBy]);

  const handleDelete = async (product: ProductWithRelations) => {
    if (!confirm(`Delete "${product.name}"? This will also delete all stock entries.`)) return;

    setDeleting(product.id);
    try {
      // Delete picture from storage first (fail silently)
      if (product.picture_file_name) {
        await deleteProductPicture(product.picture_file_name);
      }

      const supabase = createClient();
      const { error } = await supabase.from("products").delete().eq("id", product.id);
      if (error) throw error;
      router.refresh();
    } catch {
      alert("Failed to delete product.");
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (product: ProductWithRelations) => {
    setToggling(product.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("products")
        .update({ active: !product.active })
        .eq("id", product.id);
      if (error) throw error;
      router.refresh();
    } catch {
      alert("Failed to toggle status");
    } finally {
      setToggling(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setGroupFilter("all");
    setStatusFilter("active");
  };

  const hasActiveFilters = search || groupFilter !== "all" || statusFilter !== "active";
  const activeCount = products.filter((p) => p.active).length;
  const inactiveCount = products.filter((p) => !p.active).length;

  // Get cell value for a product
  const getCellValue = (product: ProductWithRelations, key: ColumnKey): React.ReactNode => {
    switch (key) {
      case "picture":
        return (
          <button onClick={() => handleOpenProduct(product)} className="block focus:outline-none">
            <ProductImage fileName={product.picture_file_name} name={product.name} />
          </button>
        );
      case "name":
        return (
          <button
            onClick={() => handleOpenProduct(product)}
            className="flex items-center gap-2 text-left hover:text-soma transition-colors focus:outline-none"
          >
            <span className={cn("font-medium", !product.active && "line-through text-gray-500")}>
              {product.name}
            </span>
            {!product.active && (
              <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">inactive</span>
            )}
          </button>
        );
      case "location":
        return product.location?.name ?? "—";
      case "min_stock_amount":
        return product.min_stock_amount || "—";
      case "qu_purchase":
        return product.qu_purchase?.name ?? "—";
      case "qu_stock":
        return product.qu_stock?.name ?? "—";
      case "product_group":
        return product.product_group?.name ?? "—";
      case "shopping_location":
        return product.shopping_location?.name ?? "—";
      default:
        return "—";
    }
  };

  // Get visible columns in order
  const visibleColumnDefs = ALL_COLUMNS.filter((col) => isColumnVisible(col.key));

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <Button asChild className="bg-soma hover:bg-soma/90">
          <Link href="/products/new">
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Add Product</span>
            <span className="sm:hidden">Add</span>
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <p className="text-sm text-gray-500 mb-4">
        {activeCount} active, {inactiveCount} inactive
        {filteredProducts.length !== products.length && (
          <span className="ml-2">• Showing {filteredProducts.length}</span>
        )}
      </p>

      {/* Mobile filter toggle */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="sm:hidden flex items-center gap-2 text-sm text-gray-600 mb-3"
      >
        {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        Filters
        {hasActiveFilters && (
          <span className="bg-soma text-white text-xs px-1.5 py-0.5 rounded-full">!</span>
        )}
      </button>

      {/* Filters */}
      <div className={cn(
        "grid gap-3 mb-4",
        showFilters ? "grid" : "hidden sm:grid",
        "sm:grid-cols-5"
      )}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {productGroups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="inactive">Inactive only</SelectItem>
          </SelectContent>
        </Select>

        {/* Table Options Button - Desktop */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="hidden sm:flex gap-2">
              <Settings2 className="h-4 w-4" />
              Table options
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-64" 
            align="start" 
            side="bottom"
            sideOffset={4}
            collisionPadding={16}
          >
            <TableOptionsContent
              visibleColumns={visibleColumns}
              toggleColumn={toggleColumn}
              groupBy={groupBy}
              handleGroupByChange={handleGroupByChange}
              resetTableOptions={resetTableOptions}
            />
          </PopoverContent>
        </Popover>

        {/* Table Options Button - Mobile (shows inline panel) */}
        <Button
          variant="outline"
          className="sm:hidden gap-2"
          onClick={() => setShowTableOptions(!showTableOptions)}
        >
          <Settings2 className="h-4 w-4" />
          Table options
          {showTableOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {hasActiveFilters && (
          <Button variant="outline" onClick={clearFilters} className="gap-1">
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Mobile Table Options Panel (inline, not popover) */}
      {showTableOptions && (
        <div className="sm:hidden mb-4 p-4 bg-white rounded-lg border shadow-sm">
          <TableOptionsContent
            visibleColumns={visibleColumns}
            toggleColumn={toggleColumn}
            groupBy={groupBy}
            handleGroupByChange={handleGroupByChange}
            resetTableOptions={resetTableOptions}
          />
        </div>
      )}

      {/* Mobile sort dropdown */}
      <div className="md:hidden mb-3">
        <Select
          value={`${sortField}-${sortDirection}`}
          onValueChange={(v) => {
            const [field, dir] = v.split("-") as [SortField, SortDirection];
            setSortField(field);
            setSortDirection(dir);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name (A-Z)</SelectItem>
            <SelectItem value="name-desc">Name (Z-A)</SelectItem>
            <SelectItem value="product_group-asc">Group (A-Z)</SelectItem>
            <SelectItem value="product_group-desc">Group (Z-A)</SelectItem>
            <SelectItem value="location-asc">Location (A-Z)</SelectItem>
            <SelectItem value="location-desc">Location (Z-A)</SelectItem>
            <SelectItem value="min_stock_amount-asc">Min Stock (Low-High)</SelectItem>
            <SelectItem value="min_stock_amount-desc">Min Stock (High-Low)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 [&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:rounded-full">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 text-left">
              {visibleColumnDefs.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2 text-xs font-medium text-gray-500",
                    col.key === "picture" && "w-14",
                    col.key === "name" && "min-w-[150px]",
                    col.key !== "picture" && col.key !== "name" && "w-28"
                  )}
                >
                  {col.sortField ? (
                    <SortHeader
                      label={col.label}
                      field={col.sortField}
                      currentSort={sortField}
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                  ) : (
                    col.label
                  )}
                </th>
              ))}
              <th className="w-28 px-3 py-2 sticky right-0 bg-gray-100 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]"></th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={visibleColumnDefs.length + 1} className="text-center py-12 bg-white">
                  <p className="text-gray-500">
                    {products.length === 0 ? "No products yet." : "No products match your filters."}
                  </p>
                  {products.length === 0 && (
                    <Button asChild variant="link" className="mt-2">
                      <Link href="/products/new">Add your first product</Link>
                    </Button>
                  )}
                </td>
              </tr>
            ) : (
              groupedProducts.map(({ groupName, products: groupProducts }) => (
                <Fragment key={groupName || "all"}>
                  {/* Group header */}
                  {groupBy !== "none" && (
                    <tr className="bg-gray-200">
                      <td colSpan={visibleColumnDefs.length + 1} className="px-3 py-2 text-sm font-medium text-gray-700">
                        <div className="flex items-center gap-2">
                          <ChevronDown className="h-4 w-4" />
                          {groupName}
                          <span className="text-gray-500 font-normal">({groupProducts.length})</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Products in group */}
                  {groupProducts.map((product) => (
                    <tr
                      key={product.id}
                      className={cn(
                        "bg-white border-b border-gray-100 hover:bg-gray-50",
                        !product.active && "opacity-60"
                      )}
                    >
                      {visibleColumnDefs.map((col) => (
                        <td key={col.key} className="px-3 py-2 text-sm text-gray-600">
                          {getCellValue(product, col.key)}
                        </td>
                      ))}
                      <td className="px-3 py-2 sticky right-0 bg-white shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" asChild>
                            <Link href={`/products/${product.id}/edit`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-8 w-8",
                              product.active ? "text-green-600 hover:text-gray-600" : "text-gray-400 hover:text-green-600"
                            )}
                            onClick={() => handleToggleActive(product)}
                            disabled={toggling === product.id}
                          >
                            {product.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-red-600"
                            onClick={() => handleDelete(product)}
                            disabled={deleting === product.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Table */}
      <div className="md:hidden overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="bg-gray-100 text-left">
              {isColumnVisible("picture") && <th className="px-2 py-2 w-12"></th>}
              <th className="px-2 py-2 text-xs font-medium text-gray-500">Name</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 w-20">Location</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 w-16">Min</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 w-16">QU</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 w-24">Group</th>
              <th className="px-2 py-2 sticky right-0 bg-gray-100 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)] w-24"></th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 bg-white">
                  <p className="text-gray-500">
                    {products.length === 0 ? "No products yet." : "No products match your filters."}
                  </p>
                </td>
              </tr>
            ) : (
              groupedProducts.map(({ groupName, products: groupProducts }) => (
                <Fragment key={groupName || "all"}>
                  {groupBy !== "none" && (
                    <tr className="bg-gray-200">
                      <td colSpan={7} className="px-2 py-2 text-sm font-medium text-gray-700">
                        <div className="flex items-center gap-2">
                          <ChevronDown className="h-4 w-4" />
                          {groupName}
                          <span className="text-gray-500 font-normal">({groupProducts.length})</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {groupProducts.map((product) => (
                    <tr
                      key={product.id}
                      className={cn(
                        "bg-white border-b border-gray-100",
                        !product.active && "opacity-60"
                      )}
                    >
                      {isColumnVisible("picture") && (
                        <td className="px-2 py-2">
                          <button onClick={() => handleOpenProduct(product)} className="block focus:outline-none">
                            <ProductImage fileName={product.picture_file_name} name={product.name} />
                          </button>
                        </td>
                      )}
                      <td className="px-2 py-2 text-sm font-medium">
                        <button
                          onClick={() => handleOpenProduct(product)}
                          className="text-left hover:text-soma transition-colors focus:outline-none"
                        >
                          {product.name}
                        </button>
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-600">{product.location?.name ?? "—"}</td>
                      <td className="px-2 py-2 text-sm text-gray-600">{product.min_stock_amount || "—"}</td>
                      <td className="px-2 py-2 text-sm text-gray-600">{product.qu_stock?.name ?? "—"}</td>
                      <td className="px-2 py-2 text-sm text-gray-600">{product.product_group?.name ?? "—"}</td>
                      <td className="px-2 py-2 sticky right-0 bg-white shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-blue-600" asChild>
                            <Link href={`/products/${product.id}/edit`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-7 w-7",
                              product.active ? "text-green-600 hover:text-gray-600" : "text-gray-400 hover:text-green-600"
                            )}
                            onClick={() => handleToggleActive(product)}
                            disabled={toggling === product.id}
                          >
                            {product.active ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-400 hover:text-red-600"
                            onClick={() => handleDelete(product)}
                            disabled={deleting === product.id}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalProduct && (
        <ProductDetailModal
          entries={modalEntries}
          product={modalProduct}
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setModalEntries([]);
            setModalProduct(null);
          }}
        />
      )}
    </>
  );
}