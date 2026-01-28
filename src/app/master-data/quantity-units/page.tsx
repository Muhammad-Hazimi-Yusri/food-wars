import { createClient } from "@/lib/supabase/server";
import { QuantityUnit } from "@/types/database";
import { MasterDataList } from "@/components/master-data/MasterDataList";
import { FieldConfig } from "@/components/master-data/MasterDataForm";

const fields: FieldConfig[] = [
  { name: "name", label: "Name (singular)", type: "text", required: true, placeholder: "e.g. piece" },
  { name: "name_plural", label: "Name (plural)", type: "text", placeholder: "e.g. pieces" },
  { name: "description", label: "Description", type: "textarea", placeholder: "Optional notes" },
  { name: "sort_order", label: "Sort Order", type: "number" },
  { name: "active", label: "Active", type: "checkbox" },
];

export default async function QuantityUnitsPage() {
  const supabase = await createClient();

  const { data: quantityUnits } = await supabase
    .from("quantity_units")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return (
    <MasterDataList<QuantityUnit>
      table="quantity_units"
      title="Quantity Unit"
      titlePlural="Quantity Units"
      items={quantityUnits ?? []}
      fields={fields}
      entityType="quantity_unit"
    />
  );
}