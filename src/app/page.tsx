import { createClient } from "@/lib/supabase/server";
import { Noren } from "@/components/diner/Noren";
import { StockList } from "@/components/inventory/StockList";
import { WelcomeModal } from "@/components/diner/WelcomeModal";
import { StockEntryWithProduct } from "@/types/database";

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
        qu_stock:quantity_units(*)
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
        <StockList entries={entries} />
      </main>
      <WelcomeModal />
    </div>
  );
}