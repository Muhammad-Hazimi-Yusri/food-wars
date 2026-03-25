import { createClient } from "@/lib/supabase/server";
import { Noren } from "@/components/diner/Noren";
import { redirect } from "next/navigation";
import { SetupClient } from "@/components/cook-now/SetupClient";
import { formatAmount } from "@/lib/format-utils";

export type ProductForSetup = {
  id: string;
  name: string;
  cooking_role: string | null;
  product_group_name: string | null;
  stock_amount: number;
  stock_display: string;
  unit_name: string;
};

async function getProductsWithStock(): Promise<ProductForSetup[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: entries } = await supabase
    .from("stock_entries")
    .select(
      `
      product_id,
      amount,
      product:products(
        id,
        name,
        cooking_role,
        product_group:product_groups(name),
        qu_stock:quantity_units!products_qu_id_stock_fkey(name)
      )
    `
    )
    .gt("amount", 0);

  if (!entries || entries.length === 0) return [];

  // Aggregate stock amount by product
  const map = new Map<string, ProductForSetup>();

  for (const entry of entries) {
    const p = entry.product as unknown as {
      id: string;
      name: string;
      cooking_role: string | null;
      product_group: { name: string } | null;
      qu_stock: { name: string } | null;
    } | null;

    if (!p) continue;

    const existing = map.get(p.id);
    if (existing) {
      existing.stock_amount += entry.amount;
      existing.stock_display = `${formatAmount(existing.stock_amount)} ${existing.unit_name}`;
    } else {
      const unitName = p.qu_stock?.name ?? "unit";
      map.set(p.id, {
        id: p.id,
        name: p.name,
        cooking_role: p.cooking_role,
        product_group_name: p.product_group?.name ?? null,
        stock_amount: entry.amount,
        stock_display: `${formatAmount(entry.amount)} ${unitName}`,
        unit_name: unitName,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export default async function SetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const products = await getProductsWithStock();

  return (
    <div className="min-h-screen bg-hayama">
      <Noren />
      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        <SetupClient products={products} />
      </main>
    </div>
  );
}
