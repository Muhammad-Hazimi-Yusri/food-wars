import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/inventory/ProductForm";
import { Noren } from "@/components/diner/Noren";

async function getMasterData() {
  const supabase = await createClient();
  
  const [locations, shoppingLocations, productGroups, quantityUnits] = await Promise.all([
    supabase.from("locations").select("*").order("sort_order"),
    supabase.from("shopping_locations").select("*").order("sort_order"),
    supabase.from("product_groups").select("*").order("sort_order"),
    supabase.from("quantity_units").select("*").order("sort_order"),
  ]);

  return {
    locations: locations.data ?? [],
    shoppingLocations: shoppingLocations.data ?? [],
    productGroups: productGroups.data ?? [],
    quantityUnits: quantityUnits.data ?? [],
  };
}

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/");
  }

  const masterData = await getMasterData();

  return (
    <div className="min-h-screen">
      <Noren />
      <main className="p-4 sm:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Product</h1>
        <ProductForm {...masterData} />
      </main>
    </div>
  );
}