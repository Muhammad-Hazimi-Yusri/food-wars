import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Noren } from "@/components/diner/Noren";
import { ProductForm } from "@/components/inventory/ProductForm";

type Props = {
  searchParams: Promise<{ barcode?: string; returnTo?: string }>;
};

export default async function NewProductPage({ searchParams }: Props) {
  const { barcode, returnTo } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [
    { data: products },
    { data: locations },
    { data: shoppingLocations },
    { data: productGroups },
    { data: quantityUnits },
  ] = await Promise.all([
    supabase.from("products").select("id, name").eq("active", true).order("name"),
    supabase.from("locations").select("*").eq("active", true).order("name"),
    supabase.from("shopping_locations").select("*").eq("active", true).order("name"),
    supabase.from("product_groups").select("*").eq("active", true).order("name"),
    supabase.from("quantity_units").select("*").eq("active", true).order("name"),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <Noren />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <ProductForm
          products={products ?? []}
          locations={locations ?? []}
          shoppingLocations={shoppingLocations ?? []}
          productGroups={productGroups ?? []}
          quantityUnits={quantityUnits ?? []}
          mode="create"
          initialBarcode={barcode ?? null}
          returnTo={returnTo ?? null}
        />
      </main>
    </div>
  );
}