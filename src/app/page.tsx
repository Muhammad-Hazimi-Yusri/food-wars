import { createClient } from "@/lib/supabase/server";
import { Noren } from "@/components/diner/Noren";
import { StockList } from "@/components/inventory/StockList";
import { WelcomeModal } from "@/components/diner/WelcomeModal";
import { AddStockEntryModal } from "@/components/inventory/AddStockEntryModal";
import { StockEntryWithProduct } from "@/types/database";
import Link from "next/link";
import { Plus } from "lucide-react";

async function getStockEntries(): Promise<StockEntryWithProduct[]> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  // If not signed in, return empty (guest mode handled client-side)
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
    <div className="min-h-screen">
      <Noren />
      <main className="p-4 sm:p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-megumi">Inventory</h2>
          <div className="flex gap-2">
            <AddStockEntryModal />
            <Link
              href="/products/new"
              className="inline-flex items-center gap-2 bg-soma text-white px-4 py-2 rounded-lg hover:bg-soma-light transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </Link>
          </div>
        </div>
        <StockList entries={entries} />
      </main>
      <WelcomeModal />
    </div>
  );
}