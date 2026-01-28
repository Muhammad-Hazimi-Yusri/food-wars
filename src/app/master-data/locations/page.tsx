import { createClient } from "@/lib/supabase/server";
import { Location } from "@/types/database";
import { MasterDataList } from "@/components/master-data/MasterDataList";
import { FieldConfig } from "@/components/master-data/MasterDataForm";

const fields: FieldConfig[] = [
  { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Fridge" },
  { name: "description", label: "Description", type: "textarea", placeholder: "Optional notes" },
  { name: "is_freezer", label: "Is a freezer (affects due dates when moving stock)", type: "checkbox" },
  { name: "sort_order", label: "Sort Order", type: "number" },
  { name: "active", label: "Active", type: "checkbox" },
];

export default async function LocationsPage() {
  const supabase = await createClient();

  const { data: locations } = await supabase
    .from("locations")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return (
    <MasterDataList<Location>
      table="locations"
      title="Location"
      titlePlural="Locations"
      items={locations ?? []}
      fields={fields}
      entityType="location"
    />
  );
}