import { createClient } from "@/lib/supabase/server";
import { Noren } from "@/components/diner/Noren";
import { ShoppingListDetailClient } from "@/components/shopping/ShoppingListDetailClient";
import { notFound } from "next/navigation";
import type {
  ShoppingList,
  ShoppingListItemWithRelations,
  StockEntryWithProduct,
  Product,
  QuantityUnit,
  Location,
  ShoppingLocation,
} from "@/types/database";

type ProductWithUnits = Product & {
  qu_stock?: QuantityUnit | null;
  qu_purchase?: QuantityUnit | null;
};

type QuantityUnitConversion = {
  id: string;
  product_id: string | null;
  from_qu_id: string;
  to_qu_id: string;
  factor: number;
};

async function getListData(id: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [
    listRes, itemsRes, productsRes, quantityUnitsRes,
    locationsRes, shoppingLocationsRes, conversionsRes, stockEntriesRes,
  ] = await Promise.all([
    supabase
      .from("shopping_lists")
      .select("*")
      .eq("id", id)
      .single(),
    supabase
      .from("shopping_list_items")
      .select(`
        *,
        product:products(
          id, name, product_group_id, shopping_location_id, qu_id_purchase, qu_id_stock, min_stock_amount, location_id, default_due_days,
          product_group:product_groups(id, name),
          shopping_location:shopping_locations(id, name),
          qu_purchase:quantity_units!products_qu_id_purchase_fkey(id, name, name_plural)
        ),
        qu:quantity_units(id, name, name_plural)
      `)
      .eq("shopping_list_id", id)
      .order("sort_order"),
    supabase
      .from("products")
      .select(`
        *,
        qu_stock:quantity_units!products_qu_id_stock_fkey(*),
        qu_purchase:quantity_units!products_qu_id_purchase_fkey(*)
      `)
      .eq("active", true)
      .order("name"),
    supabase
      .from("quantity_units")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("locations")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("shopping_locations")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("quantity_unit_conversions")
      .select("id, product_id, from_qu_id, to_qu_id, factor"),
    supabase
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
      .gt("amount", 0),
  ]);

  if (!listRes.data) return null;

  return {
    list: listRes.data as ShoppingList,
    items: (itemsRes.data as ShoppingListItemWithRelations[]) ?? [],
    products: (productsRes.data as ProductWithUnits[]) ?? [],
    quantityUnits: (quantityUnitsRes.data as QuantityUnit[]) ?? [],
    locations: (locationsRes.data as Location[]) ?? [],
    shoppingLocations: (shoppingLocationsRes.data as ShoppingLocation[]) ?? [],
    conversions: (conversionsRes.data as QuantityUnitConversion[]) ?? [],
    stockEntries: (stockEntriesRes.data as StockEntryWithProduct[]) ?? [],
  };
}

export default async function ShoppingListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getListData(id);

  if (!data) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Noren />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <ShoppingListDetailClient
          list={data.list}
          initialItems={data.items}
          products={data.products}
          quantityUnits={data.quantityUnits}
          conversions={data.conversions}
          stockEntries={data.stockEntries}
        />
      </main>
    </div>
  );
}
