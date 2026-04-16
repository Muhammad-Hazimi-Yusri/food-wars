import { formatAmount } from "@/lib/format-utils";
import { GUEST_HOUSEHOLD_ID } from "@/lib/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AggregatedItem = {
  n: string;
  qty: string;
  exp?: string;
  loc?: string;
};

/**
 * Shared aggregator. Accepts any Supabase client (cookie-session or
 * service-role) and the household_id to filter by. The explicit household
 * filter makes this safe to call from service-role routes that bypass RLS.
 *
 * This module has no "use server" directive and is imported by API routes
 * and the server-action wrapper alike. Do NOT import from a client component.
 */
export async function buildInventoryItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  householdId: string
): Promise<{ items: AggregatedItem[]; today: string; error?: string }> {
  const today = new Date().toISOString().split("T")[0];

  const { data: entries, error } = await supabase
    .from("stock_entries")
    .select(
      `product_id, amount, best_before_date, location_id,
       product:products(name, qu_stock:quantity_units!products_qu_id_stock_fkey(name)),
       location:locations(name)`
    )
    .eq("household_id", householdId)
    .gt("amount", 0)
    .order("best_before_date", { ascending: true, nullsFirst: false });

  if (error) {
    return { items: [], today, error: error.message };
  }

  const agg = new Map<
    string,
    { totalAmount: number; unit: string; nearestExpiry: string | null; locations: Set<string> }
  >();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const e of (entries ?? []) as any[]) {
    const product = Array.isArray(e.product) ? e.product[0] : e.product;
    const quStock = product?.qu_stock
      ? Array.isArray(product.qu_stock)
        ? product.qu_stock[0]
        : product.qu_stock
      : null;
    const location = Array.isArray(e.location) ? e.location[0] : e.location;

    const name: string = product?.name ?? "Unknown";
    const unit: string = quStock?.name ?? "unit";
    const locName: string | null = location?.name ?? null;

    const existing = agg.get(name);
    if (existing) {
      existing.totalAmount += e.amount;
      if (!existing.nearestExpiry && e.best_before_date) {
        existing.nearestExpiry = e.best_before_date;
      }
      if (locName) existing.locations.add(locName);
    } else {
      const locations = new Set<string>();
      if (locName) locations.add(locName);
      agg.set(name, {
        totalAmount: e.amount,
        unit,
        nearestExpiry: e.best_before_date ?? null,
        locations,
      });
    }
  }

  const sorted = [...agg.entries()].sort(([, a], [, b]) => {
    if (a.nearestExpiry && b.nearestExpiry) return a.nearestExpiry.localeCompare(b.nearestExpiry);
    if (a.nearestExpiry) return -1;
    if (b.nearestExpiry) return 1;
    return 0;
  });

  const items: AggregatedItem[] = sorted.map(([name, data]) => {
    const qty = `${formatAmount(data.totalAmount)} ${data.unit}`;
    const item: AggregatedItem = { n: name, qty };
    if (data.nearestExpiry) item.exp = data.nearestExpiry;
    if (data.locations.size > 0) item.loc = [...data.locations].join(", ");
    return item;
  });

  return { items, today };
}

/**
 * Format the preamble + JSON string used by the clipboard export and the
 * ?preamble=1 query param on the API route.
 */
export function formatInventoryPreamble(items: AggregatedItem[], today: string): string {
  return `Kitchen inventory as of ${today}. Suggest recipes using items expiring soon first.\n${JSON.stringify(items)}`;
}

/**
 * Resolve the current user's household_id from a cookie-authenticated client.
 * Handles guest/anon mode. Returns null if not authenticated or no household.
 */
export async function resolveCurrentHouseholdId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (user.is_anonymous) return GUEST_HOUSEHOLD_ID;

  const { data: household } = await supabase
    .from("households")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  return household?.id ?? null;
}
