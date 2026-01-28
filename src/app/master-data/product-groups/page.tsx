import { createClient } from "@/lib/supabase/server";
import { ProductGroup } from "@/types/database";
import { MasterDataList } from "@/components/master-data/MasterDataList";
import { FieldConfig } from "@/components/master-data/MasterDataForm";

const fields: FieldConfig[] = [
  { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. 01 Dairy" },
  { name: "description", label: "Description", type: "textarea", placeholder: "Optional notes" },
  { name: "sort_order", label: "Sort Order", type: "number" },
  { name: "active", label: "Active", type: "checkbox" },
];

export default async function ProductGroupsPage() {
  const supabase = await createClient();

  const { data: productGroups } = await supabase
    .from("product_groups")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return (
    <MasterDataList<ProductGroup>
      table="product_groups"
      title="Product Group"
      titlePlural="Product Groups"
      items={productGroups ?? []}
      fields={fields}
      entityType="product_group"
    />
  );
}