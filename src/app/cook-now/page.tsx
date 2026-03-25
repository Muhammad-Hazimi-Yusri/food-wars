import { createClient } from "@/lib/supabase/server";
import { Noren } from "@/components/diner/Noren";
import { CookingPot } from "lucide-react";
import Link from "next/link";
import { formatAmount } from "@/lib/format-utils";
import {
  getExpiryStatus,
  getExpiryDaysLabel,
  type ExpiryStatus,
} from "@/lib/inventory-utils";
import {
  DASHBOARD_BUCKETS,
  COOKING_ROLE_TO_BUCKET,
  type DashboardBucketKey,
} from "@/lib/constants";
import { DashboardClient } from "@/components/cook-now/DashboardClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProductForDashboard = {
  id: string;
  name: string;
  cooking_role: string | null;
  stock_amount: number;
  stock_display: string;
  unit_name: string;
  earliest_expiry: string | null;
  due_type: number;
  expiry_status: ExpiryStatus;
  expiry_label: string;
};

export type DashboardBuckets = Record<DashboardBucketKey, ProductForDashboard[]>;

// ---------------------------------------------------------------------------
// Data fetch
// ---------------------------------------------------------------------------

async function getDashboardData(): Promise<{
  buckets: DashboardBuckets;
  hasTaggedProducts: boolean;
  totalProducts: number;
} | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: entries } = await supabase
    .from("stock_entries")
    .select(
      `
      product_id,
      amount,
      best_before_date,
      product:products(
        id,
        name,
        cooking_role,
        due_type,
        qu_stock:quantity_units!products_qu_id_stock_fkey(name)
      )
    `
    )
    .gt("amount", 0);

  if (!entries || entries.length === 0) {
    // No stock at all — return empty buckets
    const empty: DashboardBuckets = {
      seasoning_system: [],
      protein: [],
      form_factor_base: [],
      produce: [],
      starch: [],
      other: [],
      untagged: [],
    };
    return { buckets: empty, hasTaggedProducts: false, totalProducts: 0 };
  }

  // Aggregate stock entries by product
  const map = new Map<
    string,
    {
      id: string;
      name: string;
      cooking_role: string | null;
      due_type: number;
      unit_name: string;
      total_amount: number;
      earliest_expiry: string | null;
    }
  >();

  for (const entry of entries) {
    const p = entry.product as unknown as {
      id: string;
      name: string;
      cooking_role: string | null;
      due_type: number;
      qu_stock: { name: string } | null;
    } | null;

    if (!p) continue;

    const existing = map.get(p.id);
    if (existing) {
      existing.total_amount += entry.amount;
      // Track earliest expiry (non-null minimum)
      if (entry.best_before_date) {
        if (
          !existing.earliest_expiry ||
          entry.best_before_date < existing.earliest_expiry
        ) {
          existing.earliest_expiry = entry.best_before_date;
        }
      }
    } else {
      map.set(p.id, {
        id: p.id,
        name: p.name,
        cooking_role: p.cooking_role,
        due_type: p.due_type ?? 1,
        unit_name: p.qu_stock?.name ?? "unit",
        total_amount: entry.amount,
        earliest_expiry: entry.best_before_date ?? null,
      });
    }
  }

  // Build ProductForDashboard array
  const products: ProductForDashboard[] = [];
  let hasTagged = false;

  for (const raw of map.values()) {
    if (raw.cooking_role) hasTagged = true;
    const expiryStatus = getExpiryStatus(raw.earliest_expiry, raw.due_type);
    products.push({
      id: raw.id,
      name: raw.name,
      cooking_role: raw.cooking_role,
      stock_amount: raw.total_amount,
      stock_display: `${formatAmount(raw.total_amount)} ${raw.unit_name}`,
      unit_name: raw.unit_name,
      earliest_expiry: raw.earliest_expiry,
      due_type: raw.due_type,
      expiry_status: expiryStatus,
      expiry_label: getExpiryDaysLabel(raw.earliest_expiry),
    });
  }

  // Bucket products by cooking role
  const buckets: DashboardBuckets = {
    seasoning_system: [],
    protein: [],
    form_factor_base: [],
    produce: [],
    starch: [],
    other: [],
    untagged: [],
  };

  const statusPriority: Record<ExpiryStatus, number> = {
    expired: 0,
    overdue: 1,
    due_soon: 2,
    fresh: 3,
    none: 4,
  };

  for (const product of products) {
    const bucketKey = product.cooking_role
      ? COOKING_ROLE_TO_BUCKET[product.cooking_role] ?? "other"
      : "untagged";
    buckets[bucketKey].push(product);
  }

  // Sort each bucket: expiry urgency → earliest date → alphabetical
  for (const key of DASHBOARD_BUCKETS) {
    buckets[key].sort((a, b) => {
      const sp = statusPriority[a.expiry_status] - statusPriority[b.expiry_status];
      if (sp !== 0) return sp;
      // Earliest expiry first (nulls last)
      if (a.earliest_expiry !== b.earliest_expiry) {
        if (!a.earliest_expiry) return 1;
        if (!b.earliest_expiry) return -1;
        return a.earliest_expiry.localeCompare(b.earliest_expiry);
      }
      return a.name.localeCompare(b.name);
    });
  }

  return {
    buckets,
    hasTaggedProducts: hasTagged,
    totalProducts: products.length,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CookNowPage() {
  const data = await getDashboardData();

  // Not authenticated
  if (!data) {
    return (
      <div className="min-h-screen bg-hayama">
        <Noren />
        <main className="max-w-5xl mx-auto p-4 sm:p-6">
          <p className="text-muted-foreground">
            Please sign in to use Cook Now.
          </p>
        </main>
      </div>
    );
  }

  // No tagged products — prompt to set up
  if (!data.hasTaggedProducts) {
    return (
      <div className="min-h-screen bg-hayama">
        <Noren />
        <main className="max-w-5xl mx-auto p-4 sm:p-6">
          <div className="text-center py-16">
            <CookingPot className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">Tag your products to get started</p>
            <p className="text-sm text-gray-400 mt-1">
              Assign cooking roles to your inventory, then let Cook Now suggest
              what to make.
            </p>
            <Link
              href="/cook-now/setup"
              className="inline-flex items-center mt-4 px-4 py-2 rounded bg-soma text-white hover:bg-soma-dark text-sm"
            >
              Get Started
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-hayama">
      <Noren />
      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        <DashboardClient buckets={data.buckets} />
      </main>
    </div>
  );
}
