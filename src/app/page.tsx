import { createClient } from "@/lib/supabase/server";
import { Noren } from "@/components/diner/Noren";
import { WelcomeModal } from "@/components/diner/WelcomeModal";
import { AddStockEntryModal } from "@/components/inventory/AddStockEntryModal";
import { StockOverviewClient } from "@/components/inventory/StockOverviewClient";
import { StockEntryWithProduct, Location, ProductGroup, Product, QuantityUnit, ShoppingLocation } from "@/types/database";
import { ScanToStockFlow } from "@/components/barcode/ScanToStockFlow";
import { ExportForAIButton } from "@/components/inventory/ExportForAIButton";
import { AiImportMenu } from "@/components/inventory/AiImportMenu";
import { NotificationBell } from "@/components/inventory/NotificationBell";
import { ExpiryAnnouncer } from "@/components/inventory/ExpiryAnnouncer";
import { TodaysDinnerCard } from "@/components/meal-plan/TodaysDinnerCard";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";

type QuantityUnitConversion = {
  id: string;
  product_id: string | null;
  from_qu_id: string;
  to_qu_id: string;
  factor: number;
};

async function getStockData(): Promise<{
  entries: StockEntryWithProduct[];
  locations: Location[];
  productGroups: ProductGroup[];
  productsWithMinStock: Product[];
  products: Product[];
  quantityUnits: QuantityUnit[];
  shoppingLocations: ShoppingLocation[];
  conversions: QuantityUnitConversion[];
}> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      entries: [],
      locations: [],
      productGroups: [],
      productsWithMinStock: [],
      products: [],
      quantityUnits: [],
      shoppingLocations: [],
      conversions: [],
    };
  }

  const [
    entriesRes,
    locationsRes,
    productGroupsRes,
    productsWithMinStockRes,
    productsRes,
    quantityUnitsRes,
    shoppingLocationsRes,
    conversionsRes,
  ] = await Promise.all([
    supabase
      .from("stock_entries")
      .select(`
        *,
        product:products(
          *,
          product_group:product_groups(*),
          qu_stock:quantity_units!products_qu_id_stock_fkey(*)
        ),
        location:locations(*)
      `)
      .gt("amount", 0)
      .order("best_before_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("locations")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("product_groups")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .gt("min_stock_amount", 0),
    supabase
      .from("products")
      .select(`
        *,
        qu_stock:quantity_units!products_qu_id_stock_fkey(*),
        qu_purchase:quantity_units!products_qu_id_purchase_fkey(*)
      `)
      .eq("active", true)
      .order("name"),
    supabase
      .from("quantity_units")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("shopping_locations")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("quantity_unit_conversions")
      .select("*"),
  ]);

  // Fetch original purchase amounts from stock_log for percentage-based consume calculations.
  // stock_log purchase rows store the amount at purchase time; stock_entries.amount is current remaining.
  const rawEntries = entriesRes.data ?? [];
  const stockIds = rawEntries.map((e) => e.stock_id).filter(Boolean) as string[];
  let origMap: Record<string, number> = {};
  if (stockIds.length > 0) {
    const { data: purchaseLogs } = await supabase
      .from("stock_log")
      .select("stock_id, amount")
      .in("stock_id", stockIds)
      .eq("transaction_type", "purchase")
      .eq("undone", false);
    origMap = Object.fromEntries(
      (purchaseLogs ?? []).map((r) => [r.stock_id!, r.amount])
    );
  }
  const entries = rawEntries.map((e) => ({
    ...e,
    originalAmount: origMap[e.stock_id] ?? null,
  }));

  return {
    entries,
    locations: locationsRes.data ?? [],
    productGroups: productGroupsRes.data ?? [],
    productsWithMinStock: productsWithMinStockRes.data ?? [],
    products: productsRes.data ?? [],
    quantityUnits: quantityUnitsRes.data ?? [],
    shoppingLocations: shoppingLocationsRes.data ?? [],
    conversions: conversionsRes.data ?? [],
  };
}

export default async function Home() {
  const {
    entries,
    locations,
    productGroups,
    productsWithMinStock,
    products,
    quantityUnits,
    shoppingLocations,
    conversions,
  } = await getStockData();

  // Aggregate stock per product for the Add Stock modal's insight panel
  const stockSummary = new Map<string, number>();
  for (const e of entries) {
    stockSummary.set(e.product_id, (stockSummary.get(e.product_id) ?? 0) + e.amount);
  }

  return (
    <div className="min-h-screen bg-hayama">
      <Noren />
      <main className="p-4 sm:p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-megumi">Stock Overview</h1>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <AiImportMenu
              householdData={{
                products,
                locations,
                quantityUnits,
                shoppingLocations,
                conversions,
              }}
            />
            <ExportForAIButton />
          </div>
        </div>

        {/* Browser-notification permission prompt (renders only when needed) */}
        <ExpiryAnnouncer />

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <AddStockEntryModal
            products={products}
            locations={locations}
            quantityUnits={quantityUnits}
            shoppingLocations={shoppingLocations}
            conversions={conversions}
            stockSummary={stockSummary}
          />
          <ScanToStockFlow
            products={products}
            locations={locations}
            quantityUnits={quantityUnits}
            shoppingLocations={shoppingLocations}
            conversions={conversions}
            stockSummary={stockSummary}
          />
          <Link
            href="/products/new"
            className="inline-flex items-center justify-center gap-2 bg-soma text-white px-4 py-3 rounded-lg hover:bg-soma/90 transition-colors font-medium"
          >
            <Plus className="h-5 w-5" />
            <span>Add Product</span>
          </Link>
        </div>

        {/* Tonight's dinner — only renders when Dinner entries exist today */}
        <Suspense fallback={null}>
          <TodaysDinnerCard />
        </Suspense>

        {/* Client-side filtering wrapper */}
        <StockOverviewClient
          entries={entries}
          locations={locations}
          productGroups={productGroups}
          productsWithMinStock={productsWithMinStock}
        />
      </main>
      <WelcomeModal />
    </div>
  );
}
