"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { X, ChevronUp, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  COOKING_ROLE_TO_BUCKET,
  DASHBOARD_BUCKET_LABELS,
  DASHBOARD_BUCKETS,
  type DashboardBucketKey,
} from "@/lib/constants";
import type { ProductForDashboard } from "@/app/cook-now/page";
import type { ExpiryStatus } from "@/lib/inventory-utils";

const badgeColors: Record<ExpiryStatus, string> = {
  expired: "bg-red-100 text-red-700",
  overdue: "bg-gray-200 text-gray-700",
  due_soon: "bg-amber-100 text-amber-700",
  fresh: "bg-green-100 text-green-700",
  none: "bg-gray-100 text-gray-600",
};

function groupByRole(items: ProductForDashboard[]) {
  const groups: Partial<Record<DashboardBucketKey, ProductForDashboard[]>> = {};
  for (const item of items) {
    const key = item.cooking_role
      ? COOKING_ROLE_TO_BUCKET[item.cooking_role] ?? "other"
      : "untagged";
    (groups[key] ??= []).push(item);
  }
  // Return in dashboard bucket order
  return DASHBOARD_BUCKETS.filter((k) => groups[k]?.length)
    .map((k) => ({ key: k, label: DASHBOARD_BUCKET_LABELS[k], items: groups[k]! }));
}

// ---------------------------------------------------------------------------
// Staged item chip
// ---------------------------------------------------------------------------

function StagedChip({
  product,
  onRemove,
}: {
  product: ProductForDashboard;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-soma/5 border border-soma/20 text-sm">
      <span className="truncate max-w-[120px]">{product.name}</span>
      {product.expiry_label && (
        <span
          className={cn(
            "text-[10px] px-1.5 py-0 rounded",
            badgeColors[product.expiry_status]
          )}
        >
          {product.expiry_label}
        </span>
      )}
      <button
        onClick={onRemove}
        className="p-0.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Desktop staging area (sidebar)
// ---------------------------------------------------------------------------

type StagingAreaProps = {
  items: ProductForDashboard[];
  onClear: () => void;
  onRemoveItem: (productId: string) => void;
  isDragging: boolean;
};

export function StagingAreaDesktop({
  items,
  onClear,
  onRemoveItem,
  isDragging,
}: StagingAreaProps) {
  const { setNodeRef, isOver } = useDroppable({ id: "staging-area" });

  const groups = groupByRole(items);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "sticky top-4 rounded-lg border-2 border-dashed p-4 transition-all min-h-[200px]",
        isOver
          ? "border-soma ring-2 ring-soma/40 bg-soma/5"
          : items.length > 0
            ? "border-soma/30 bg-white"
            : "border-gray-300 bg-gray-50/50",
        isDragging && items.length === 0 && "border-soma/50 bg-soma/5 animate-pulse"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-megumi text-sm">Meal Idea</h3>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-gray-600 h-7 px-2"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          Drag products here to build a meal idea
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map(({ key, label, items: groupItems }) => (
            <div key={key}>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                {label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {groupItems.map((p) => (
                  <StagedChip
                    key={p.id}
                    product={p}
                    onRemove={() => onRemoveItem(p.id)}
                  />
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400 pt-1">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile staging area (fixed bottom bar)
// ---------------------------------------------------------------------------

export function StagingAreaMobile({
  items,
  onClear,
  onRemoveItem,
  isDragging,
}: StagingAreaProps) {
  const [expanded, setExpanded] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: "staging-area-mobile" });

  const groups = groupByRole(items);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 border-t-2 border-dashed transition-all",
        isOver
          ? "border-soma bg-soma/5"
          : items.length > 0
            ? "border-soma/30 bg-white"
            : "border-gray-300 bg-gray-50",
        isDragging && items.length === 0 && "border-soma/50 bg-soma/5"
      )}
    >
      {/* Collapsed bar / header */}
      <button
        onClick={() => items.length > 0 && setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <span className="font-display text-megumi text-sm">Meal Idea</span>
          {items.length > 0 && (
            <span className="text-xs bg-soma/10 text-soma px-2 py-0.5 rounded-full font-medium">
              {items.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                  setExpanded(false);
                }}
                className="text-xs text-gray-400 hover:text-gray-600 h-7 px-2"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <ChevronUp
                className={cn(
                  "h-4 w-4 text-gray-400 transition-transform duration-200",
                  !expanded && "rotate-180"
                )}
              />
            </>
          )}
          {items.length === 0 && (
            <span className="text-xs text-gray-400">
              {isDragging ? "Drop here!" : "Drag products here"}
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && items.length > 0 && (
        <div className="px-4 pb-4 max-h-60 overflow-y-auto space-y-3">
          {groups.map(({ key, label, items: groupItems }) => (
            <div key={key}>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                {label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {groupItems.map((p) => (
                  <StagedChip
                    key={p.id}
                    product={p}
                    onRemove={() => onRemoveItem(p.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
