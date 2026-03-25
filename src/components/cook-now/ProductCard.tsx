"use client";

import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { ProductForDashboard } from "@/app/cook-now/page";
import type { ExpiryStatus } from "@/lib/inventory-utils";

const badgeColors: Record<ExpiryStatus, string> = {
  expired: "bg-red-100 text-red-700",
  overdue: "bg-gray-200 text-gray-700",
  due_soon: "bg-amber-100 text-amber-700",
  fresh: "bg-green-100 text-green-700",
  none: "bg-gray-100 text-gray-600",
};

const borderColors: Record<ExpiryStatus, string> = {
  expired: "border-l-kurokiba",
  overdue: "border-l-gray-500",
  due_soon: "border-l-takumi",
  fresh: "border-l-green-500",
  none: "border-l-gray-300",
};

type ProductCardProps = {
  product: ProductForDashboard;
  isStaged?: boolean;
};

export function ProductCard({ product, isStaged }: ProductCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `product:${product.id}` });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border-l-4 bg-white border border-gray-100 shadow-sm cursor-grab active:cursor-grabbing select-none",
        borderColors[product.expiry_status],
        isDragging && "opacity-40",
        isStaged && "opacity-60",
        "touch-none"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800 truncate">
          {product.name}
        </p>
        <p className="text-xs text-gray-500">{product.stock_display}</p>
      </div>
      {product.expiry_label && (
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded whitespace-nowrap",
            badgeColors[product.expiry_status]
          )}
        >
          {product.expiry_label}
        </span>
      )}
      {isStaged && (
        <span className="text-xs text-soma font-medium">✓</span>
      )}
    </div>
  );
}

/** Non-draggable variant used inside DragOverlay */
export function ProductCardOverlay({
  product,
}: {
  product: ProductForDashboard;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border-l-4 bg-white border border-gray-100 shadow-lg cursor-grabbing rotate-2 scale-105",
        borderColors[product.expiry_status]
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800 truncate">
          {product.name}
        </p>
        <p className="text-xs text-gray-500">{product.stock_display}</p>
      </div>
      {product.expiry_label && (
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded whitespace-nowrap",
            badgeColors[product.expiry_status]
          )}
        >
          {product.expiry_label}
        </span>
      )}
    </div>
  );
}
