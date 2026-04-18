"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  Package,
  Barcode,
  AlertTriangle,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { ParsedImportItem, NameRef } from "@/types/ai-import";
import { fetchOffEnrichmentAction } from "@/lib/ai-import-actions";

export type ReviewMasterData = {
  products: { id: string; name: string }[];
  quantityUnits: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  shoppingLocations: { id: string; name: string }[];
  productGroups: { id: string; name: string }[];
};

type Props = {
  items: ParsedImportItem[];
  masterData: ReviewMasterData;
  includedIndices: Set<number>;
  onToggleIncluded: (index: number) => void;
  onItemChange: (index: number, next: ParsedImportItem) => void;
  onRemove: (index: number) => void;
};

const MATCH_BADGES: Record<string, { label: string; class: string }> = {
  match_id: { label: "Matched by id", class: "bg-green-50 border-green-200 text-green-700" },
  barcode: { label: "Matched by barcode", class: "bg-green-50 border-green-200 text-green-700" },
  fuzzy_name: { label: "Matched by name", class: "bg-emerald-50 border-emerald-200 text-emerald-700" },
};

export function ParsedItemsReview({
  items,
  masterData,
  includedIndices,
  onToggleIncluded,
  onItemChange,
  onRemove,
}: Props) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <ReviewRow
          key={index}
          item={item}
          index={index}
          masterData={masterData}
          included={includedIndices.has(index)}
          onToggle={() => onToggleIncluded(index)}
          onChange={(next) => onItemChange(index, next)}
          onRemove={() => onRemove(index)}
        />
      ))}
    </div>
  );
}

type RowProps = {
  item: ParsedImportItem;
  index: number;
  masterData: ReviewMasterData;
  included: boolean;
  onToggle: () => void;
  onChange: (next: ParsedImportItem) => void;
  onRemove: () => void;
};

function ReviewRow({ item, index, masterData, included, onToggle, onChange, onRemove }: RowProps) {
  const [expanded, setExpanded] = useState(item.kind === "new-product");
  const [fetchingOff, setFetchingOff] = useState(false);

  const productLabel =
    item.kind === "existing-product" ? item.product_name : item.product.name;
  const barcode = item.kind === "new-product" ? item.product.barcode : null;
  const hasNutrition = item.kind === "new-product" && item.product.nutrition != null;

  const handleFetchOff = async () => {
    if (item.kind !== "new-product" || !barcode) return;
    setFetchingOff(true);
    try {
      const res = await fetchOffEnrichmentAction(barcode);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      onChange({
        ...item,
        product: {
          ...item.product,
          brand: item.product.brand ?? res.brand,
          nutrition: res.nutrition ?? item.product.nutrition,
        },
      });
      toast.success("Enriched from Open Food Facts");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setFetchingOff(false);
    }
  };

  return (
    <div
      className={`rounded-lg border text-left ${
        !included ? "bg-gray-50 border-gray-200 opacity-60" : "bg-white border-gray-200"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-2.5">
        <input
          type="checkbox"
          checked={included}
          onChange={onToggle}
          className="h-4 w-4 accent-megumi"
          aria-label={`Include ${productLabel}`}
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-gray-400 hover:text-gray-600"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          {item.kind === "existing-product" ? (
            <span
              className={`text-[10px] font-medium border px-1.5 py-0.5 rounded ${
                MATCH_BADGES[item.match_reason].class
              }`}
            >
              {MATCH_BADGES[item.match_reason].label}
            </span>
          ) : (
            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5" />
              New product
            </span>
          )}
          <span className="font-medium text-sm truncate">{productLabel}</span>
          {item.errors.length > 0 && (
            <span
              title={item.errors.join("\n")}
              className="text-[10px] font-medium text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {item.errors.length} issue{item.errors.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-600 shrink-0"
          aria-label="Remove item"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="border-t border-gray-100 p-2.5 space-y-3">
          {/* Stock entry fields */}
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Stock entry
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                type="number"
                step="0.1"
                min="0"
                value={item.stock.amount}
                onChange={(e) =>
                  onChange({
                    ...item,
                    stock: { ...item.stock, amount: parseFloat(e.target.value) || 1 },
                  })
                }
                className="text-[11px] h-7"
                placeholder="Amount"
              />
              <NameRefSelect
                value={item.stock.qu}
                candidates={masterData.quantityUnits}
                placeholder="Unit"
                onChange={(next) => onChange({ ...item, stock: { ...item.stock, qu: next } })}
                allowCreate={false}
              />
              <Input
                type="date"
                value={item.stock.best_before_date ?? ""}
                onChange={(e) =>
                  onChange({
                    ...item,
                    stock: { ...item.stock, best_before_date: e.target.value || null },
                  })
                }
                className="text-[11px] h-7"
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={item.stock.price ?? ""}
                onChange={(e) =>
                  onChange({
                    ...item,
                    stock: {
                      ...item.stock,
                      price: e.target.value ? parseFloat(e.target.value) : null,
                    },
                  })
                }
                className="text-[11px] h-7"
                placeholder="Price (total)"
              />
              <NameRefSelect
                value={item.stock.shopping_location}
                candidates={masterData.shoppingLocations}
                placeholder="Store"
                onChange={(next) =>
                  onChange({ ...item, stock: { ...item.stock, shopping_location: next } })
                }
                allowCreate={true}
              />
              <NameRefSelect
                value={item.stock.location}
                candidates={masterData.locations}
                placeholder="Location"
                onChange={(next) =>
                  onChange({ ...item, stock: { ...item.stock, location: next } })
                }
                allowCreate={true}
              />
            </div>
            {item.stock.note && (
              <p className="text-[10px] text-gray-500 mt-1 italic">Note: {item.stock.note}</p>
            )}
          </div>

          {/* New-product block */}
          {item.kind === "new-product" && (
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Package className="h-3 w-3" />
                New product defaults
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  value={item.product.name}
                  onChange={(e) =>
                    onChange({ ...item, product: { ...item.product, name: e.target.value } })
                  }
                  className="text-[11px] h-7 col-span-2"
                  placeholder="Product name"
                />
                <Input
                  value={item.product.brand ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...item,
                      product: { ...item.product, brand: e.target.value || null },
                    })
                  }
                  className="text-[11px] h-7"
                  placeholder="Brand"
                />
                <Input
                  value={item.product.barcode ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...item,
                      product: { ...item.product, barcode: e.target.value || null },
                    })
                  }
                  className="text-[11px] h-7"
                  placeholder="Barcode"
                />
                <NameRefSelect
                  value={item.product.qu_stock}
                  candidates={masterData.quantityUnits}
                  placeholder="Stock unit"
                  onChange={(next) =>
                    onChange({ ...item, product: { ...item.product, qu_stock: next } })
                  }
                  allowCreate={false}
                />
                <NameRefSelect
                  value={item.product.qu_purchase}
                  candidates={masterData.quantityUnits}
                  placeholder="Purchase unit"
                  onChange={(next) =>
                    onChange({ ...item, product: { ...item.product, qu_purchase: next } })
                  }
                  allowCreate={false}
                />
                <NameRefSelect
                  value={item.product.location}
                  candidates={masterData.locations}
                  placeholder="Default location"
                  onChange={(next) =>
                    onChange({ ...item, product: { ...item.product, location: next } })
                  }
                  allowCreate={true}
                />
                <NameRefSelect
                  value={item.product.shopping_location}
                  candidates={masterData.shoppingLocations}
                  placeholder="Default store"
                  onChange={(next) =>
                    onChange({ ...item, product: { ...item.product, shopping_location: next } })
                  }
                  allowCreate={true}
                />
                <NameRefSelect
                  value={item.product.product_group}
                  candidates={masterData.productGroups}
                  placeholder="Category"
                  onChange={(next) =>
                    onChange({ ...item, product: { ...item.product, product_group: next } })
                  }
                  allowCreate={true}
                />
                <Input
                  type="number"
                  min="0"
                  value={item.product.default_due_days || ""}
                  onChange={(e) =>
                    onChange({
                      ...item,
                      product: {
                        ...item.product,
                        default_due_days: parseInt(e.target.value, 10) || 0,
                      },
                    })
                  }
                  className="text-[11px] h-7"
                  placeholder="Default due days"
                />
                <Select
                  value={item.product.due_type === 2 ? "expiration" : "best_before"}
                  onValueChange={(val) =>
                    onChange({
                      ...item,
                      product: {
                        ...item.product,
                        due_type: val === "expiration" ? 2 : 1,
                      },
                    })
                  }
                >
                  <SelectTrigger className="text-[11px] h-7">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="best_before">Best before</SelectItem>
                    <SelectItem value="expiration">Use by</SelectItem>
                  </SelectContent>
                </Select>
                {item.product.purchase_to_stock_factor != null && (
                  <Input
                    type="number"
                    step="0.01"
                    value={item.product.purchase_to_stock_factor}
                    onChange={(e) =>
                      onChange({
                        ...item,
                        product: {
                          ...item.product,
                          purchase_to_stock_factor: parseFloat(e.target.value) || null,
                        },
                      })
                    }
                    className="text-[11px] h-7 col-span-2"
                    placeholder="Purchase → stock factor"
                  />
                )}
              </div>

              {/* OFF enrichment */}
              {barcode && !hasNutrition && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={fetchingOff}
                  onClick={handleFetchOff}
                  className="mt-2 h-7 text-[11px] gap-1"
                >
                  {fetchingOff ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Barcode className="h-3 w-3" />
                  )}
                  Fetch nutrition from Open Food Facts
                </Button>
              )}

              {hasNutrition && (
                <p className="text-[10px] text-gray-500 mt-2 italic">
                  Nutrition data present — will be saved with the product.
                </p>
              )}
            </div>
          )}

          {item.errors.length > 0 && (
            <ul className="text-[11px] text-red-600 list-disc list-inside space-y-0.5">
              {item.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!expanded && (
        <div className="px-2.5 pb-2 text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
          <span>
            {item.stock.amount} {item.stock.qu?.name ?? "?"}
          </span>
          {item.stock.best_before_date && <span>BB {item.stock.best_before_date}</span>}
          {item.stock.price != null && <span>£{item.stock.price.toFixed(2)}</span>}
          {item.stock.shopping_location && <span>@ {item.stock.shopping_location.name}</span>}
          {(void index, null)}
        </div>
      )}
    </div>
  );
}

/**
 * Select / create widget for a master-data reference.
 * Shows existing options, plus an "Create new &lt;name&gt;" option when allowed
 * and the user has a proposed name from the LLM that doesn't match anything.
 */
function NameRefSelect({
  value,
  candidates,
  placeholder,
  onChange,
  allowCreate,
}: {
  value: NameRef | null;
  candidates: { id: string; name: string }[];
  placeholder: string;
  onChange: (next: NameRef | null) => void;
  allowCreate: boolean;
}) {
  const selectValue = value?.id ?? (value?.name ? "__pending__" : "__none__");

  return (
    <Select
      value={selectValue}
      onValueChange={(val) => {
        if (val === "__none__") {
          onChange(null);
        } else if (val === "__pending__") {
          // keep current pending value
          onChange(value);
        } else {
          const found = candidates.find((c) => c.id === val);
          if (found) onChange({ id: found.id, name: found.name });
        }
      }}
    >
      <SelectTrigger
        className={`text-[11px] h-7 ${
          value && !value.id ? "border-amber-300 bg-amber-50" : ""
        }`}
      >
        <SelectValue placeholder={placeholder}>
          {value ? (
            value.id ? (
              value.name
            ) : allowCreate ? (
              <span className="text-amber-700">
                Create &quot;{value.name}&quot;
              </span>
            ) : (
              <span className="text-amber-700">Unmatched: {value.name}</span>
            )
          ) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— none —</SelectItem>
        {value && !value.id && allowCreate && (
          <SelectItem value="__pending__">
            <span className="text-amber-700">
              Create &quot;{value.name}&quot;
            </span>
          </SelectItem>
        )}
        {candidates.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
