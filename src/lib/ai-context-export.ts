/**
 * Build the "prompt bundle" the user copies into an external LLM
 * (Claude.ai / ChatGPT) so it can emit JSON matching our import schema.
 *
 * The bundle contains:
 *   - System instructions describing the task
 *   - Compact lists of the household's master-data (so the LLM matches names
 *     instead of inventing variants like "grams" vs "g")
 *   - The JSON schema (imported from `types/ai-import.ts`)
 *   - Two worked examples
 *
 * Output is one markdown string ready for the clipboard / download.
 *
 * This module has no "use server" directive so it can be imported by either a
 * server action or an API route. Do NOT import from a client component.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { IMPORT_JSON_SCHEMA } from "@/types/ai-import";

type Row = Record<string, unknown>;

async function fetchList(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  table: string,
  select: string,
  householdId: string,
  orderBy = "name",
): Promise<Row[]> {
  const { data } = await supabase
    .from(table)
    .select(select)
    .eq("household_id", householdId)
    .order(orderBy);
  return (data as unknown as Row[]) ?? [];
}

/**
 * Build the full prompt bundle. Runs database queries via the supplied
 * supabase client — the caller is responsible for authenticating and
 * resolving the household_id.
 */
export async function buildImportContextBundle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  householdId: string,
): Promise<string> {
  const [units, locations, stores, groups] = await Promise.all([
    fetchList(supabase, "quantity_units", "id, name, name_plural", householdId, "name"),
    fetchList(supabase, "locations", "id, name, is_freezer", householdId, "name"),
    fetchList(supabase, "shopping_locations", "id, name", householdId, "name"),
    fetchList(supabase, "product_groups", "id, name", householdId, "name"),
  ]);

  const today = new Date().toISOString().split("T")[0];

  const lines: string[] = [];

  lines.push("# Food Wars — AI Ingredient Import");
  lines.push("");
  lines.push(
    "You are helping me add items to my kitchen stock. I will send photos of " +
      "product packaging (barcode, nutrition label, best-before date) and/or " +
      "supermarket receipts. For each item, produce a JSON object that matches " +
      "the schema below. Reply with ONLY the JSON object, wrapped in a " +
      "```json fenced block — no prose before or after.",
  );
  lines.push("");
  lines.push(`Today's date: ${today}`);
  lines.push("");

  lines.push("## Rules");
  lines.push("");
  lines.push(
    "1. When matching against units, locations, stores, or groups below — use " +
      "the EXACT name shown, not a variant. " +
      "For units especially: if the list has `g`, use `g`, not `grams`.",
  );
  lines.push(
    "2. Always fill the `product` block completely — describe the product as " +
      "you see it (name, brand, barcode, nutrition, etc). Existing products " +
      "are auto-matched on my side by barcode and name, so don't worry about " +
      "duplicates.",
  );
  lines.push(
    "3. For nutrition, use per-100g or per-100mL values (not per-serving).",
  );
  lines.push(
    "4. If the receipt / packaging doesn't say, infer sensibly: " +
      "`qu_stock_name` should be a fine-grained unit (g, mL, piece); " +
      "`qu_purchase_name` should reflect packaging (tin, pack, bottle). " +
      "`purchase_to_stock_factor` converts one purchase unit into stock units.",
  );
  lines.push(
    "5. For `best_before_date`, use ISO `YYYY-MM-DD`. If the label only shows a " +
      "month+year (e.g. \"BB 03/2027\"), pick the 1st of that month.",
  );
  lines.push(
    "6. Return one item per distinct product. If a receipt lists 3 tins of the " +
      "same beans, emit one item with `stock.amount: 3`.",
  );
  lines.push("");

  lines.push("## Existing master-data");
  lines.push("");
  lines.push("### UNITS (use these exact names for `qu_stock_name`, `qu_purchase_name`, `stock.unit_name`)");
  if (units.length === 0) {
    lines.push("_(none defined — propose reasonable units; the app will prompt me to create them)_");
  } else {
    lines.push(units.map((u) => `- ${u.name}${u.name_plural ? ` (pl. ${u.name_plural})` : ""}`).join("\n"));
  }
  lines.push("");

  lines.push("### LOCATIONS (storage places — use for `location_name`)");
  if (locations.length === 0) {
    lines.push("_(none defined — propose a reasonable name)_");
  } else {
    lines.push(
      locations
        .map((l) => `- ${l.name}${l.is_freezer ? " (freezer)" : ""}`)
        .join("\n"),
    );
  }
  lines.push("");

  lines.push("### STORES (shopping locations — use for `store_name`, `shopping_location_name`)");
  if (stores.length === 0) {
    lines.push("_(none defined — propose a reasonable name)_");
  } else {
    lines.push(stores.map((s) => `- ${s.name}`).join("\n"));
  }
  lines.push("");

  lines.push("### GROUPS (product categories — use for `product_group_name`)");
  if (groups.length === 0) {
    lines.push("_(none defined — propose a reasonable name)_");
  } else {
    lines.push(groups.map((g) => `- ${g.name}`).join("\n"));
  }
  lines.push("");

  lines.push("## JSON schema");
  lines.push("");
  lines.push("```json");
  lines.push(IMPORT_JSON_SCHEMA);
  lines.push("```");
  lines.push("");

  lines.push("## Examples");
  lines.push("");
  lines.push("### Example A — receipt line for a common product");
  lines.push("");
  lines.push("```json");
  lines.push(`{
  "version": "1",
  "items": [
    {
      "product": {
        "name": "Semi-skimmed Milk",
        "brand": "Tesco",
        "barcode": "5000436589217"
      },
      "stock": {
        "amount": 2, "unit_name": "L", "best_before_date": "2026-05-10",
        "price": 2.40, "store_name": "Tesco", "location_name": "Fridge"
      }
    }
  ]
}`);
  lines.push("```");
  lines.push("");

  lines.push("### Example B — new product from packaging photo");
  lines.push("");
  lines.push("```json");
  lines.push(`{
  "version": "1",
  "items": [
    {
      "product": {
        "name": "Heinz Baked Beans",
        "brand": "Heinz",
        "barcode": "5000157024671",
        "qu_stock_name": "g",
        "qu_purchase_name": "tin",
        "purchase_to_stock_factor": 415,
        "location_name": "Pantry",
        "shopping_location_name": "Tesco",
        "product_group_name": "Tinned Goods",
        "default_due_days": 730,
        "due_type": "best_before",
        "cooking_role": "protein",
        "nutrition": {
          "energy_kcal": 75, "fat": 0.2, "saturated_fat": 0.1,
          "carbohydrates": 13, "sugars": 5, "fibre": 3.8,
          "protein": 4.7, "salt": 0.6, "nutrition_grade": "a"
        }
      },
      "stock": {
        "amount": 4, "unit_name": "tin", "best_before_date": "2027-03-01",
        "price": 3.80, "store_name": "Tesco", "location_name": "Pantry",
        "note": "4-pack"
      }
    }
  ]
}`);
  lines.push("```");
  lines.push("");

  lines.push(
    "Now wait for my photo(s) or receipt, then reply with the JSON object only.",
  );

  return lines.join("\n");
}
