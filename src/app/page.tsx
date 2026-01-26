import { createClient } from "@/lib/supabase/server";
import { Noren } from "@/components/diner/Noren";
import { MobileStockList } from "@/components/inventory/MobileStockList";
import { DesktopStockTable } from "@/components/inventory/DesktopStockTable";
import { InventoryStats } from "@/components/inventory/InventoryStats";
import { WelcomeModal } from "@/components/diner/WelcomeModal";
import { AddStockEntryModal } from "@/components/inventory/AddStockEntryModal";
import { StockEntryWithProduct } from "@/types/database";
import Link from "next/link";
import { Plus } from "lucide-react";

async function getStockEntries(): Promise<StockEntryWithProduct[]> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
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
    .order("best_before_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("Error fetching stock entries:", error);
    return [];
  }

  return data ?? [];
}

export default async function Home() {
  const entries = await getStockEntries();

  return (
    <div className="min-h-screen bg-hayama">
      <Noren />
      <main className="p-4 sm:p-6 max-w-5xl mx-auto">
        {/* Header */}
        <h1 className="text-2xl font-bold text-megumi mb-1">Stock Overview</h1>

        {/* Stats */}
        <InventoryStats entries={entries} />

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <AddStockEntryModal />
          <Link
            href="/products/new"
            className="inline-flex items-center justify-center gap-2 bg-soma text-white px-4 py-3 rounded-lg hover:bg-soma/90 transition-colors font-medium"
          >
            <Plus className="h-5 w-5" />
            <span>Add Product</span>
          </Link>
        </div>

        {/* Mobile view */}
        <div className="sm:hidden">
          <MobileStockList entries={entries} />
        </div>

        {/* Desktop view */}
        <div className="hidden sm:block">
          <DesktopStockTable entries={entries} />
        </div>
      </main>
      <WelcomeModal />
    </div>
  );
}