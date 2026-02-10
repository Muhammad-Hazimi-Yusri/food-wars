import { createClient } from "@/lib/supabase/server";
import { Noren } from "@/components/diner/Noren";
import { JournalClient } from "@/components/journal/JournalClient";
import { StockLogWithRelations, Product } from "@/types/database";

const EXCLUDED_TYPES = ["transfer-to", "stock-edit-old", "stock-edit-new"];

async function getJournalData() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      logs: [] as StockLogWithRelations[],
      products: [] as Pick<Product, "id" | "name">[],
    };
  }

  const [logsRes, productsRes] = await Promise.all([
    supabase
      .from("stock_log")
      .select(`
        *,
        product:products(id, name, qu_stock:quantity_units!products_qu_id_stock_fkey(name, name_plural)),
        location:locations(id, name)
      `)
      .not("transaction_type", "in", `(${EXCLUDED_TYPES.join(",")})`)
      .order("created_at", { ascending: false }),
    supabase
      .from("products")
      .select("id, name")
      .eq("active", true)
      .order("name"),
  ]);

  return {
    logs: (logsRes.data ?? []) as StockLogWithRelations[],
    products: (productsRes.data ?? []) as Pick<Product, "id" | "name">[],
  };
}

export default async function JournalPage() {
  const { logs, products } = await getJournalData();

  return (
    <div className="min-h-screen bg-hayama">
      <Noren />
      <main className="p-4 sm:p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-megumi mb-4">Stock Journal</h1>
        <JournalClient logs={logs} products={products} />
      </main>
    </div>
  );
}
