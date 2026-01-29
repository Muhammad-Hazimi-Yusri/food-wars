import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Noren } from "@/components/diner/Noren";
import { ProductForm } from "@/components/inventory/ProductForm";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/");
  }

  const [
    { data: product },
    { data: products },
    { data: locations },
    { data: shoppingLocations },
    { data: productGroups },
    { data: quantityUnits },
  ] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase.from("products").select("id, name").eq("active", true).order("name"),
    supabase.from("locations").select("*").eq("active", true).order("name"),
    supabase.from("shopping_locations").select("*").eq("active", true).order("name"),
    supabase.from("product_groups").select("*").eq("active", true).order("name"),
    supabase.from("quantity_units").select("*").eq("active", true).order("name"),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <Noren />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <ProductForm
          product={product}
          products={products ?? []}
          locations={locations ?? []}
          shoppingLocations={shoppingLocations ?? []}
          productGroups={productGroups ?? []}
          quantityUnits={quantityUnits ?? []}
          mode="edit"
        />
      </main>
    </div>
  );
}