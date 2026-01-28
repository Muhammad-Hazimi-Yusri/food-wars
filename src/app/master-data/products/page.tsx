import { createClient } from "@/lib/supabase/server";
import { ProductsListClient } from "@/components/master-data/ProductsListClient";

export default async function ProductsPage() {
  const supabase = await createClient();

  const [
    { data: products },
    { data: productGroups },
  ] = await Promise.all([
    supabase
      .from("products")
      .select(`
        *,
        location:locations!products_location_id_fkey(id, name),
        product_group:product_groups(id, name),
        qu_stock:quantity_units!products_qu_id_stock_fkey(id, name, name_plural),
        qu_purchase:quantity_units!products_qu_id_purchase_fkey(id, name, name_plural),
        shopping_location:shopping_locations(id, name)
      `)
      .order("name", { ascending: true }),
    supabase
      .from("product_groups")
      .select("*")
      .eq("active", true)
      .order("name"),
  ]);

  return (
    <ProductsListClient
      products={products ?? []}
      productGroups={productGroups ?? []}
    />
  );
}