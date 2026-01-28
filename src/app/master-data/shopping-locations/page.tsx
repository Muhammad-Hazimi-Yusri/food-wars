import { createClient } from "@/lib/supabase/server";
import { ShoppingLocation } from "@/types/database";
import { MasterDataList } from "@/components/master-data/MasterDataList";
import { FieldConfig } from "@/components/master-data/MasterDataForm";

const fields: FieldConfig[] = [
  { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Tesco" },
  { name: "description", label: "Description", type: "textarea", placeholder: "e.g. Main store for weekly shop" },
  { name: "sort_order", label: "Sort Order", type: "number" },
  { name: "active", label: "Active", type: "checkbox" },
];

export default async function ShoppingLocationsPage() {
  const supabase = await createClient();

  const { data: shoppingLocations } = await supabase
    .from("shopping_locations")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return (
    <MasterDataList<ShoppingLocation>
      table="shopping_locations"
      title="Store"
      titlePlural="Stores"
      items={shoppingLocations ?? []}
      fields={fields}
      entityType="shopping_location"
    />
  );
}