"use server";

import { createClient } from "@/lib/supabase/server";
import { formatAmount } from "@/lib/format-utils";

type AggregatedItem = {
  n: string;
  qty: string;
  exp?: string;
  loc?: string;
};

export async function exportInventoryForAI(): Promise<{
  success: boolean;
  text?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: entries, error } = await supabase
    .from("stock_entries")
    .select(
      `product_id, amount, best_before_date, location_id,
       product:products(name, qu_stock:quantity_units!products_qu_id_stock_fkey(name)),
       location:locations(name)`
    )
    .gt("amount", 0)
    .order("best_before_date", { ascending: true, nullsFirst: false });

  if (error) {
    return { success: false, error: error.message };
  }

  // Aggregate by product name
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
      // Entries are sorted by best_before_date ascending, so the first non-null is the nearest
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

  // Sort by nearest expiry first (nulls last)
  const sorted = [...agg.entries()].sort(([, a], [, b]) => {
    if (a.nearestExpiry && b.nearestExpiry) return a.nearestExpiry.localeCompare(b.nearestExpiry);
    if (a.nearestExpiry) return -1;
    if (b.nearestExpiry) return 1;
    return 0;
  });

  // Format as compact JSON
  const items: AggregatedItem[] = sorted.map(([name, data]) => {
    const qty = `${formatAmount(data.totalAmount)} ${data.unit}`;
    const item: AggregatedItem = { n: name, qty };
    if (data.nearestExpiry) item.exp = data.nearestExpiry;
    if (data.locations.size > 0) item.loc = [...data.locations].join(", ");
    return item;
  });

  const today = new Date().toISOString().split("T")[0];
  const text = `Kitchen inventory as of ${today}. Suggest recipes using items expiring soon first.\n${JSON.stringify(items)}`;

  return { success: true, text };
}
