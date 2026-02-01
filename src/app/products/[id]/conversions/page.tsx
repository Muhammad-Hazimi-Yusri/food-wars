import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Noren } from "@/components/diner/Noren";
import { ProductConversionsClient } from "@/components/inventory/ProductConversionsClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProductConversionsPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/");
  }

  const [
    { data: product },
    { data: conversions },
    { data: quantityUnits },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, qu_id_stock, qu_stock:quantity_units!products_qu_id_stock_fkey(name)")
      .eq("id", id)
      .single(),
    supabase
      .from("quantity_unit_conversions")
      .select("*, from_qu:quantity_units!quantity_unit_conversions_from_qu_id_fkey(name), to_qu:quantity_units!quantity_unit_conversions_to_qu_id_fkey(name)")
      .eq("product_id", id)
      .order("created_at"),
    supabase
      .from("quantity_units")
      .select("*")
      .eq("active", true)
      .order("name"),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <Noren />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <ProductConversionsClient
          product={product}
          conversions={conversions ?? []}
          quantityUnits={quantityUnits ?? []}
        />
      </main>
    </div>
  );
}