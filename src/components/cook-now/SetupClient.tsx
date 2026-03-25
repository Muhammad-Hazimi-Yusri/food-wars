"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { updateCookingRole } from "@/lib/cook-now-actions";
import {
  COOKING_ROLES,
  COOKING_ROLE_LABELS,
  COOKING_ROLE_AUTO_SUGGEST,
  type SetupCookingRole,
} from "@/lib/constants";
import type { CookingRole } from "@/types/database";
import type { ProductForSetup } from "@/app/cook-now/setup/page";

// ---------------------------------------------------------------------------
// Auto-suggest helper
// ---------------------------------------------------------------------------

function suggestRole(groupName: string | null): SetupCookingRole | null {
  if (!groupName) return null;
  const lower = groupName.toLowerCase();
  for (const { keywords, role } of COOKING_ROLE_AUTO_SUGGEST) {
    if (keywords.some((kw) => lower.includes(kw))) return role;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SetupClient({ products }: { products: ProductForSetup[] }) {
  const router = useRouter();

  // Build initial roles map: use existing DB value, or auto-suggest for untagged
  const { initRoles, initSuggested } = useMemo(() => {
    const roles: Record<string, CookingRole | null> = {};
    const suggested = new Set<string>();

    for (const p of products) {
      if (p.cooking_role) {
        roles[p.id] = p.cooking_role as CookingRole;
      } else {
        const suggestion = suggestRole(p.product_group_name);
        roles[p.id] = suggestion;
        if (suggestion) suggested.add(p.id);
      }
    }
    return { initRoles: roles, initSuggested: suggested };
  }, [products]);

  const [roles, setRoles] = useState<Record<string, CookingRole | null>>(initRoles);
  const [suggested, setSuggested] = useState<Set<string>>(initSuggested);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"untagged" | "all">("untagged");

  // Progress
  const tagged = products.filter((p) => roles[p.id] != null).length;
  const total = products.length;
  const percent = total > 0 ? Math.round((tagged / total) * 100) : 0;

  // Filter on original server-side cooking_role so newly-tagged products don't vanish
  const filtered =
    filter === "untagged"
      ? products.filter((p) => p.cooking_role == null)
      : products;

  // ------- handlers -------

  async function handleRoleClick(productId: string, role: SetupCookingRole) {
    const prev = roles[productId];
    const next: CookingRole | null = prev === role ? null : role;

    // Optimistic update
    setRoles((r) => ({ ...r, [productId]: next }));
    setSuggested((s) => {
      const ns = new Set(s);
      ns.delete(productId);
      return ns;
    });
    setSaving((s) => new Set(s).add(productId));

    const result = await updateCookingRole(productId, next);

    setSaving((s) => {
      const ns = new Set(s);
      ns.delete(productId);
      return ns;
    });

    if (!result.success) {
      setRoles((r) => ({ ...r, [productId]: prev }));
      toast.error(result.error ?? "Failed to save");
    }
  }

  async function handleApplyAllSuggestions() {
    const ids = Array.from(suggested);
    if (ids.length === 0) return;

    setSaving((s) => {
      const ns = new Set(s);
      ids.forEach((id) => ns.add(id));
      return ns;
    });

    const results = await Promise.allSettled(
      ids.map((id) => updateCookingRole(id, roles[id]))
    );

    setSaving((s) => {
      const ns = new Set(s);
      ids.forEach((id) => ns.delete(id));
      return ns;
    });

    const failures = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success));
    if (failures.length > 0) {
      toast.error(`${failures.length} suggestion(s) failed to save`);
    } else {
      toast.success(`${ids.length} suggestion(s) saved`);
    }

    setSuggested(new Set());
  }

  // ------- empty state -------

  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">No products in stock yet.</p>
        <p className="text-sm text-gray-400 mt-1">
          Add stock from the home page, then come back to tag your products.
        </p>
        <Link
          href="/"
          className="inline-flex items-center mt-4 px-4 py-2 rounded bg-soma text-white hover:bg-soma/90 text-sm"
        >
          Go to Inventory
        </Link>
      </div>
    );
  }

  // ------- render -------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/cook-now" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold text-megumi">Tag Your Products</h1>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600">
            {tagged} / {total} products tagged
          </span>
          <span className="text-gray-400">{percent}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-soma rounded-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Filter toggle */}
        <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
          <button
            onClick={() => setFilter("untagged")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === "untagged"
                ? "bg-white text-megumi shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Untagged only
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === "all"
                ? "bg-white text-megumi shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Show all
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Apply suggestions */}
          {suggested.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleApplyAllSuggestions}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Save {suggested.size} suggestion{suggested.size !== 1 ? "s" : ""}
            </Button>
          )}

          {/* Done */}
          <Button
            onClick={() => router.push("/cook-now")}
            className="bg-soma text-white hover:bg-soma/90"
            size="sm"
          >
            Done
          </Button>
        </div>
      </div>

      {/* Product list — mobile cards */}
      <div className="sm:hidden space-y-3">
        {filtered.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            role={roles[p.id] ?? null}
            isSuggested={suggested.has(p.id)}
            isSaving={saving.has(p.id)}
            onRoleClick={handleRoleClick}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">
            All products have been tagged!
          </p>
        )}
      </div>

      {/* Product list — desktop table */}
      <div className="hidden sm:block">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-200">
              <th className="pb-2 font-medium">Product</th>
              <th className="pb-2 font-medium">Group</th>
              <th className="pb-2 font-medium text-right">Stock</th>
              <th className="pb-2 font-medium text-center">Role</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                role={roles[p.id] ?? null}
                isSuggested={suggested.has(p.id)}
                isSaving={saving.has(p.id)}
                onRoleClick={handleRoleClick}
              />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">
            All products have been tagged!
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared role button styles
// ---------------------------------------------------------------------------

function roleButtonClass(
  role: SetupCookingRole,
  current: CookingRole | null,
  isSuggested: boolean
): string {
  const base =
    "font-medium transition-colors border text-center select-none";
  if (current === role && !isSuggested) {
    return `${base} bg-soma text-white border-soma`;
  }
  if (current === role && isSuggested) {
    return `${base} bg-soma/15 text-soma border-soma/40`;
  }
  return `${base} bg-white text-gray-600 border-gray-300 hover:border-gray-400`;
}

// ---------------------------------------------------------------------------
// Mobile card
// ---------------------------------------------------------------------------

function ProductCard({
  product,
  role,
  isSuggested,
  isSaving,
  onRoleClick,
}: {
  product: ProductForSetup;
  role: CookingRole | null;
  isSuggested: boolean;
  isSaving: boolean;
  onRoleClick: (productId: string, role: SetupCookingRole) => void;
}) {
  return (
    <div
      className={`rounded-lg bg-white p-4 border shadow-sm ${
        isSaving ? "border-soma/30" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-medium text-megumi text-sm">{product.name}</span>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {product.stock_display}
        </span>
      </div>
      {product.product_group_name && (
        <p className="text-xs text-gray-400 mb-3">{product.product_group_name}</p>
      )}
      {!product.product_group_name && <div className="mb-3" />}
      <div className="grid grid-cols-3 gap-2">
        {COOKING_ROLES.map((r) => (
          <button
            key={r}
            onClick={() => onRoleClick(product.id, r)}
            className={`min-h-[44px] rounded-full text-xs px-2 ${roleButtonClass(r, role, isSuggested)}`}
          >
            {COOKING_ROLE_LABELS[r]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop table row
// ---------------------------------------------------------------------------

function ProductRow({
  product,
  role,
  isSuggested,
  isSaving,
  onRoleClick,
}: {
  product: ProductForSetup;
  role: CookingRole | null;
  isSuggested: boolean;
  isSaving: boolean;
  onRoleClick: (productId: string, role: SetupCookingRole) => void;
}) {
  return (
    <tr
      className={`border-b border-gray-100 ${
        isSaving ? "opacity-70" : ""
      }`}
    >
      <td className="py-2.5 text-sm font-medium text-megumi">{product.name}</td>
      <td className="py-2.5 text-sm text-gray-400">
        {product.product_group_name ?? "—"}
      </td>
      <td className="py-2.5 text-sm text-gray-500 text-right whitespace-nowrap">
        {product.stock_display}
      </td>
      <td className="py-2.5">
        <div className="flex items-center justify-center gap-1.5">
          {COOKING_ROLES.map((r) => (
            <button
              key={r}
              onClick={() => onRoleClick(product.id, r)}
              className={`h-8 px-3 rounded-full text-xs ${roleButtonClass(r, role, isSuggested)}`}
            >
              {COOKING_ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </td>
    </tr>
  );
}
