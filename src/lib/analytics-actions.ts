"use server";

import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────

export type PurchaseRow = {
  purchasedAt: string;       // ISO timestamp (created_at)
  price: number | null;      // price per stock unit at purchase time
  storeName: string | null;  // shopping_location name
  storeId: string | null;
  amount: number;
};

export type ProductPurchaseHistory = {
  lastPurchasedAt: string | null;   // ISO timestamp
  lastPrice: number | null;         // price per stock unit
  avgPrice: number | null;          // avg across all logged purchases
  rows: PurchaseRow[];              // newest-first list for table + chart
};

export type ProductConsumptionStats = {
  lastConsumedAt: string | null;    // ISO timestamp
  spoilRate: number | null;         // 0–100 percentage, or null if no data
  avgShelfLifeDays: number | null;  // null when insufficient data
  rows: ConsumeRow[];               // newest-first consume + spoiled events
};

export type ConsumeRow = {
  consumedAt: string;
  amount: number;
  spoiled: boolean;
  storeName: string | null;
};

// ─────────────────────────────────────────────
// Per-product purchase history (History tab)
// ─────────────────────────────────────────────

/**
 * Returns purchase history for a single product, merging two sources:
 *  1. stock_log rows with transaction_type='purchase' (written from v0.13.1 onward)
 *  2. stock_entries rows not already represented in the log (pre-v0.13.1 purchases)
 *
 * Deduplication uses stock_log.stock_entry_id vs stock_entries.id so entries
 * added after v0.13.1 don't appear twice.
 */
export async function getProductPurchaseHistory(
  productId: string,
): Promise<ProductPurchaseHistory> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { lastPurchasedAt: null, lastPrice: null, avgPrice: null, rows: [] };

  // 1. Fetch purchase log entries from stock_log (post v0.13.1)
  const { data: logRows } = await supabase
    .from("stock_log")
    .select(`
      created_at,
      price,
      amount,
      shopping_location_id,
      stock_entry_id,
      shopping_location:shopping_locations(name)
    `)
    .eq("product_id", productId)
    .eq("transaction_type", "purchase")
    .eq("undone", false)
    .not("stock_entry_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  // Track which stock_entries are already covered by a log row
  const loggedEntryIds = new Set(
    (logRows ?? []).map((r) => r.stock_entry_id).filter(Boolean),
  );

  const logMappedRows: PurchaseRow[] = (logRows ?? []).map((r) => ({
    purchasedAt: r.created_at,
    price: r.price,
    amount: r.amount,
    storeId: r.shopping_location_id,
    storeName: (r.shopping_location as unknown as { name: string } | null)?.name ?? null,
  }));

  // 2. Always fetch stock_entries to surface pre-v0.13.1 purchases
  const { data: entryRows } = await supabase
    .from("stock_entries")
    .select(`
      id,
      price,
      purchased_date,
      amount,
      shopping_location_id,
      shopping_location:shopping_locations(name)
    `)
    .eq("product_id", productId)
    .order("purchased_date", { ascending: false });

  // 3. Exclude entries already represented by a stock_log purchase row,
  //    and skip entries with no purchased_date (nothing meaningful to show)
  const unlogged = (entryRows ?? []).filter(
    (e) => !loggedEntryIds.has(e.id) && e.purchased_date != null,
  );

  // 4. Map unlogged stock_entries to PurchaseRow
  const syntheticRows: PurchaseRow[] = unlogged.map((e) => ({
    purchasedAt: e.purchased_date!,
    price: e.price,
    amount: e.amount,
    storeId: e.shopping_location_id,
    storeName: (e.shopping_location as unknown as { name: string } | null)?.name ?? null,
  }));

  // 5. Merge and sort by date descending
  const rows = [...logMappedRows, ...syntheticRows].sort((a, b) => {
    if (!a.purchasedAt) return 1;
    if (!b.purchasedAt) return -1;
    return new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime();
  });

  // 6. Derive summary stats from the merged rows
  const lastPurchasedAt = rows[0]?.purchasedAt ?? null;
  const lastPrice = rows[0]?.price ?? null;
  const priced = rows.filter((r) => r.price != null);
  const avgPrice =
    priced.length > 0
      ? priced.reduce((s, r) => s + r.price!, 0) / priced.length
      : null;

  return { lastPurchasedAt, lastPrice, avgPrice, rows };
}

// ─────────────────────────────────────────────
// Per-product consumption analytics (Analytics tab)
// ─────────────────────────────────────────────

/**
 * Returns consumption stats for a single product from stock_log.
 * Uses consume + spoiled transaction types.
 */
export async function getProductConsumptionStats(
  productId: string,
): Promise<ProductConsumptionStats> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { lastConsumedAt: null, spoilRate: null, avgShelfLifeDays: null, rows: [] };

  const { data: logRows } = await supabase
    .from("stock_log")
    .select(`
      created_at,
      amount,
      spoiled,
      used_date,
      purchased_date,
      shopping_location_id,
      shopping_location:shopping_locations(name)
    `)
    .eq("product_id", productId)
    .in("transaction_type", ["consume", "spoiled"])
    .eq("undone", false)
    .order("created_at", { ascending: false })
    .limit(200);

  const all = logRows ?? [];

  const rows: ConsumeRow[] = all.map((r) => ({
    consumedAt: r.created_at,
    amount: r.amount,
    spoiled: r.spoiled,
    storeName: (r.shopping_location as unknown as { name: string } | null)?.name ?? null,
  }));

  const lastConsumedAt = rows[0]?.consumedAt ?? null;

  // Spoil rate: % of consume events that were spoiled
  const spoilRate =
    all.length > 0
      ? Math.round((all.filter((r) => r.spoiled).length / all.length) * 100)
      : null;

  // Average shelf life: avg(used_date - purchased_date) where both are set
  const withDates = all.filter((r) => r.used_date && r.purchased_date);
  const avgShelfLifeDays =
    withDates.length > 0
      ? Math.round(
          withDates.reduce((sum, r) => {
            const used = new Date(r.used_date!).getTime();
            const purchased = new Date(r.purchased_date!).getTime();
            return sum + (used - purchased) / (1000 * 60 * 60 * 24);
          }, 0) / withDates.length,
        )
      : null;

  return { lastConsumedAt, spoilRate, avgShelfLifeDays, rows };
}

// ─────────────────────────────────────────────
// Household-level waste report
// ─────────────────────────────────────────────

export type WasteByWeek  = { week: string; count: number; value: number };
export type WasteByGroup = { groupName: string; count: number; value: number };

export type HouseholdWaste = {
  totalItems: number;
  totalValueWasted: number;
  byWeek: WasteByWeek[];
  byGroup: WasteByGroup[];
};

/** ISO 8601 week label, e.g. "2026-W07" */
function isoWeekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Returns household-wide spoil data (all products), optionally filtered to
 * the last `days` days. Used by the Waste report page.
 */
export async function getHouseholdWaste(days?: number): Promise<HouseholdWaste> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { totalItems: 0, totalValueWasted: 0, byWeek: [], byGroup: [] };

  let query = supabase
    .from("stock_log")
    .select(`
      created_at,
      amount,
      price,
      product:products(
        name,
        product_group:product_groups(name)
      )
    `)
    .eq("spoiled", true)
    .eq("undone", false)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (days) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    query = query.gte("created_at", since.toISOString());
  }

  const { data } = await query;
  const rows = data ?? [];

  const totalItems = rows.length;
  const totalValueWasted = rows.reduce(
    (sum, r) => (r.price != null ? sum + r.price * r.amount : sum),
    0,
  );

  // Group by ISO week
  const weekMap: Record<string, { count: number; value: number }> = {};
  for (const r of rows) {
    const week = isoWeekLabel(r.created_at);
    if (!weekMap[week]) weekMap[week] = { count: 0, value: 0 };
    weekMap[week].count++;
    if (r.price != null) weekMap[week].value += r.price * r.amount;
  }
  const byWeek: WasteByWeek[] = Object.entries(weekMap)
    .map(([week, v]) => ({ week, ...v }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // Group by product group
  const groupMap: Record<string, { count: number; value: number }> = {};
  for (const r of rows) {
    const product = r.product as unknown as { name: string; product_group: { name: string } | null } | null;
    const groupName = product?.product_group?.name ?? "Uncategorised";
    if (!groupMap[groupName]) groupMap[groupName] = { count: 0, value: 0 };
    groupMap[groupName].count++;
    if (r.price != null) groupMap[groupName].value += r.price * r.amount;
  }
  const byGroup: WasteByGroup[] = Object.entries(groupMap)
    .map(([groupName, v]) => ({ groupName, ...v }))
    .sort((a, b) => b.count - a.count);

  return { totalItems, totalValueWasted, byWeek, byGroup };
}

// ─────────────────────────────────────────────
// Household-level spending report
// ─────────────────────────────────────────────

export type SpendingByGroup = { groupName: string; total: number };
export type SpendingByStore = { storeName: string; total: number };

export type HouseholdSpending = {
  totalSpend: number;
  byGroup: SpendingByGroup[];
  byStore: SpendingByStore[];
};

/**
 * Returns purchase spend stats, merging two sources:
 *  1. stock_log rows with transaction_type='purchase' (written from v0.13.1 onward)
 *  2. stock_entries rows not already represented in the log (pre-v0.13.1 purchases)
 *
 * The `days` filter applies to stock_log.created_at and stock_entries.purchased_date
 * respectively. Used by the Spending report page.
 */
export async function getHouseholdSpending(days?: number): Promise<HouseholdSpending> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { totalSpend: 0, byGroup: [], byStore: [] };

  // 1. Fetch purchase log entries from stock_log (post v0.13.1)
  let logQuery = supabase
    .from("stock_log")
    .select(`
      amount,
      price,
      stock_entry_id,
      shopping_location:shopping_locations(name),
      product:products(
        product_group:product_groups(name)
      )
    `)
    .eq("transaction_type", "purchase")
    .eq("undone", false)
    .limit(5000);

  if (days) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    logQuery = logQuery.gte("created_at", since.toISOString());
  }

  const { data: logData } = await logQuery;
  const logRows = logData ?? [];

  // Track which stock_entries are already covered by a log row
  const loggedEntryIds = new Set(
    logRows.map((r) => r.stock_entry_id).filter(Boolean),
  );

  // 2. Fetch stock_entries to surface pre-v0.13.1 purchases
  let entryQuery = supabase
    .from("stock_entries")
    .select(`
      id,
      amount,
      price,
      purchased_date,
      shopping_location:shopping_locations(name),
      product:products(
        product_group:product_groups(name)
      )
    `)
    .limit(5000);

  if (days) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    entryQuery = entryQuery.gte("purchased_date", since.toISOString().slice(0, 10));
  }

  const { data: entryData } = await entryQuery;

  // 3. Exclude entries already covered by a stock_log purchase row
  const unloggedEntries = (entryData ?? []).filter((e) => !loggedEntryIds.has(e.id));

  // 4. Aggregate spend from both sources
  let totalSpend = 0;
  const groupMap: Record<string, number> = {};
  const storeMap: Record<string, number> = {};

  for (const r of logRows) {
    if (r.price == null) continue;
    const spend = r.price * r.amount;
    totalSpend += spend;
    const product = r.product as unknown as { product_group: { name: string } | null } | null;
    groupMap[product?.product_group?.name ?? "Uncategorised"] =
      (groupMap[product?.product_group?.name ?? "Uncategorised"] ?? 0) + spend;
    const store = r.shopping_location as unknown as { name: string } | null;
    storeMap[store?.name ?? "Unknown store"] =
      (storeMap[store?.name ?? "Unknown store"] ?? 0) + spend;
  }

  for (const e of unloggedEntries) {
    if (e.price == null) continue;
    const spend = e.price * e.amount;
    totalSpend += spend;
    const product = e.product as unknown as { product_group: { name: string } | null } | null;
    groupMap[product?.product_group?.name ?? "Uncategorised"] =
      (groupMap[product?.product_group?.name ?? "Uncategorised"] ?? 0) + spend;
    const store = e.shopping_location as unknown as { name: string } | null;
    storeMap[store?.name ?? "Unknown store"] =
      (storeMap[store?.name ?? "Unknown store"] ?? 0) + spend;
  }

  const byGroup: SpendingByGroup[] = Object.entries(groupMap)
    .map(([groupName, total]) => ({ groupName, total }))
    .sort((a, b) => b.total - a.total);

  const byStore: SpendingByStore[] = Object.entries(storeMap)
    .map(([storeName, total]) => ({ storeName, total }))
    .sort((a, b) => b.total - a.total);

  return { totalSpend, byGroup, byStore };
}

// ─────────────────────────────────────────────
// Current stock value by product group
// ─────────────────────────────────────────────

export type StockValueByGroup = { groupName: string; value: number; itemCount: number };

export type HouseholdStockValue = {
  totalValue: number;
  byGroup: StockValueByGroup[];
};

/**
 * Returns current stock value grouped by product group, derived from
 * stock_entries (amount × price per unit). Used by the Stock Value report.
 */
export async function getStockValueByGroup(): Promise<HouseholdStockValue> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { totalValue: 0, byGroup: [] };

  const { data } = await supabase
    .from("stock_entries")
    .select(`
      amount,
      price,
      product:products(
        product_group:product_groups(name)
      )
    `)
    .gt("amount", 0)
    .limit(5000);

  const rows = data ?? [];
  let totalValue = 0;
  const groupMap: Record<string, { value: number; itemCount: number }> = {};

  for (const r of rows) {
    if (r.price == null) continue;
    const value = r.price * r.amount;
    totalValue += value;

    const product = r.product as unknown as { product_group: { name: string } | null } | null;
    const groupName = product?.product_group?.name ?? "Uncategorised";
    if (!groupMap[groupName]) groupMap[groupName] = { value: 0, itemCount: 0 };
    groupMap[groupName].value += value;
    groupMap[groupName].itemCount += 1;
  }

  const byGroup: StockValueByGroup[] = Object.entries(groupMap)
    .map(([groupName, v]) => ({ groupName, ...v }))
    .sort((a, b) => b.value - a.value);

  return { totalValue, byGroup };
}
