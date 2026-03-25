"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductCard } from "./ProductCard";
import type { ProductForDashboard } from "@/app/cook-now/page";

type RoleBucketProps = {
  label: string;
  products: ProductForDashboard[];
  stagedIds: Set<string>;
  defaultOpen?: boolean;
};

export function RoleBucket({
  label,
  products,
  stagedIds,
  defaultOpen = true,
}: RoleBucketProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-display text-megumi text-sm">{label}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {products.length}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-gray-400 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3 flex flex-wrap gap-2">
            {products.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No products</p>
            ) : (
              products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  isStaged={stagedIds.has(p.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
