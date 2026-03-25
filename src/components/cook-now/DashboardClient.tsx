"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  DASHBOARD_BUCKETS,
  DASHBOARD_BUCKET_LABELS,
} from "@/lib/constants";
import type { DashboardBuckets, ProductForDashboard } from "@/app/cook-now/page";
import { RoleBucket } from "./RoleBucket";
import { ProductCardOverlay } from "./ProductCard";
import { StagingAreaDesktop, StagingAreaMobile } from "./StagingArea";

type DashboardClientProps = {
  buckets: DashboardBuckets;
};

export function DashboardClient({ buckets }: DashboardClientProps) {
  const [stagedItems, setStagedItems] = useState<ProductForDashboard[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Flat lookup of all products across all buckets
  const allProducts = useMemo(() => {
    const list: ProductForDashboard[] = [];
    for (const key of DASHBOARD_BUCKETS) {
      list.push(...buckets[key]);
    }
    return list;
  }, [buckets]);

  const stagedIds = useMemo(
    () => new Set(stagedItems.map((p) => p.id)),
    [stagedItems]
  );

  // DnD sensors — same config as MealPlanWeekView
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor)
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    // Accept drop on either desktop or mobile staging area
    const overId = over.id as string;
    if (overId !== "staging-area" && overId !== "staging-area-mobile") return;

    const productId = (active.id as string).replace("product:", "");
    setStagedItems((prev) => {
      if (prev.some((p) => p.id === productId)) return prev;
      const product = allProducts.find((p) => p.id === productId);
      if (!product) return prev;
      return [...prev, product];
    });
  }

  function handleClear() {
    setStagedItems([]);
  }

  function handleRemoveItem(productId: string) {
    setStagedItems((prev) => prev.filter((p) => p.id !== productId));
  }

  const activeProduct = activeId
    ? allProducts.find((p) => `product:${p.id}` === activeId) ?? null
    : null;

  const isDragging = activeId !== null;

  // Determine which buckets have products (for defaultOpen logic)
  const nonEmptyCount = DASHBOARD_BUCKETS.filter(
    (k) => buckets[k].length > 0
  ).length;

  return (
    <DndContext
      id="cook-now-dashboard-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-megumi text-lg">Cook Now</h1>
        <Link
          href="/cook-now/setup"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-soma transition-colors"
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Edit tags</span>
        </Link>
      </div>

      {/* Desktop layout: buckets + sidebar */}
      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
        <div className="space-y-3">
          {DASHBOARD_BUCKETS.map((key) => (
            <RoleBucket
              key={key}
              label={DASHBOARD_BUCKET_LABELS[key]}
              products={buckets[key]}
              stagedIds={stagedIds}
              defaultOpen={
                key === "untagged"
                  ? nonEmptyCount === 0 || buckets[key].length > 0 && nonEmptyCount <= 1
                  : buckets[key].length > 0
              }
            />
          ))}

          {/* Attribution */}
          <p className="text-center text-xs text-gray-400 mt-8 mb-4">
            Inspired by{" "}
            <a
              href="https://www.ethanchlebowski.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600"
            >
              Ethan Chlebowski&apos;s cooking framework
            </a>
          </p>
        </div>

        {/* Desktop staging sidebar */}
        <div className="hidden lg:block">
          <StagingAreaDesktop
            items={stagedItems}
            onClear={handleClear}
            onRemoveItem={handleRemoveItem}
            isDragging={isDragging}
          />
        </div>
      </div>

      {/* Mobile staging bar */}
      <div className="lg:hidden pb-20">
        <StagingAreaMobile
          items={stagedItems}
          onClear={handleClear}
          onRemoveItem={handleRemoveItem}
          isDragging={isDragging}
        />
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeProduct ? (
          <ProductCardOverlay product={activeProduct} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
