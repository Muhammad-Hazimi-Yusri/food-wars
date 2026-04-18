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
    "2. Always include `product.name`. Also include `brand`, `barcode`, " +
      "`nutrition`, and the `qu_*` / `location_name` / `shopping_location_name` " +
      "/ `product_group_name` / `default_due_days` / `due_type` / `cooking_role` " +
      "fields whenever you can infer them — more detail helps me when the product " +
      "is new. Receipt lines usually give you only name/brand/barcode (Example A); " +
      "packaging photos should fill everything visible (Example B).",
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

  // Pick example values from the actual fetched lists so the examples can't
  // violate rule #1 (e.g. showing "tin" when the household has "can", or
  // "Tesco" when it has "Tesco Express"). Fallbacks apply for empty lists.
  const pickName = (rows: Row[], preferred: string[], fallback: string): string => {
    for (const p of preferred) {
      if (rows.some((r) => (r.name as string | undefined) === p)) return p;
    }
    return (rows[0]?.name as string | undefined) ?? fallback;
  };
  const findFirst = (rows: Row[], preferred: string[]): string | null => {
    for (const p of preferred) {
      if (rows.some((r) => (r.name as string | undefined) === p)) return p;
    }
    return null;
  };

  const exA_unit = pickName(units, ["L", "l", "ml", "mL"], "L");
  const exA_store = pickName(stores, [], "Tesco");
  const exA_location = pickName(locations, ["Fridge", "Refrigerator"], "Fridge");

  // Archetype registry for Example B: each archetype is a coherent real-world
  // product whose units/location/group we try to match against the household's
  // master-data. The first archetype where ALL four slots hit is used; if none
  // hit, Example B falls back to a short prose note (teaching-by-example only
  // works when the example is internally consistent).
  type Archetype = {
    name: string;
    brand: string;
    barcode: string;
    stockUnitPrefs: string[];
    purchaseUnitPrefs: string[];
    locationPrefs: string[];
    groupPrefs: string[];
    purchaseToStockFactor: number;
    defaultDueDays: number;
    dueType: "best_before" | "expiration";
    cookingRole: string;
    nutrition: string; // inline JSON fragment
    stockAmount: number;
    stockNote: string;
    bestBefore: string;
    price: number;
  };
  const ARCHETYPES: Archetype[] = [
    {
      name: "Heinz Baked Beans",
      brand: "Heinz",
      barcode: "5000157024671",
      stockUnitPrefs: ["g", "kg"],
      purchaseUnitPrefs: ["can", "tin"],
      locationPrefs: ["Cupboard Main", "Cupboard", "Pantry", "Kitchen Cupboard", "Shelf"],
      groupPrefs: ["Pantry Staples", "Tinned", "Canned", "Tinned Goods", "Canned Goods"],
      purchaseToStockFactor: 415,
      defaultDueDays: 730,
      dueType: "best_before",
      cookingRole: "protein",
      nutrition: `{
          "energy_kcal": 75, "fat": 0.2, "saturated_fat": 0.1,
          "carbohydrates": 13, "sugars": 5, "fibre": 3.8,
          "protein": 4.7, "salt": 0.6, "nutrition_grade": "a"
        }`,
      stockAmount: 4,
      stockNote: "4-pack",
      bestBefore: "2027-03-01",
      price: 3.8,
    },
    {
      name: "Extra Virgin Olive Oil",
      brand: "Filippo Berio",
      barcode: "8002580001006",
      stockUnitPrefs: ["ml", "mL", "L", "l"],
      purchaseUnitPrefs: ["bottle"],
      locationPrefs: ["Cupboard Main", "Cupboard", "Pantry", "Kitchen Cupboard"],
      groupPrefs: ["Oils", "Pantry Staples", "Cooking", "Condiments"],
      purchaseToStockFactor: 500,
      defaultDueDays: 540,
      dueType: "best_before",
      cookingRole: "sauce",
      nutrition: `{
          "energy_kcal": 824, "fat": 91.6, "saturated_fat": 13,
          "carbohydrates": 0, "sugars": 0,
          "protein": 0, "salt": 0, "nutrition_grade": "d"
        }`,
      stockAmount: 1,
      stockNote: "",
      bestBefore: "2027-06-01",
      price: 6.5,
    },
    {
      name: "Plain Flour",
      brand: "Allinson",
      barcode: "5011157001001",
      stockUnitPrefs: ["g", "kg"],
      purchaseUnitPrefs: ["bag", "pack", "packet"],
      locationPrefs: ["Cupboard Main", "Cupboard", "Pantry", "Kitchen Cupboard"],
      groupPrefs: ["Baking", "Pantry Staples", "Flour", "Baking Supplies"],
      purchaseToStockFactor: 1500,
      defaultDueDays: 365,
      dueType: "best_before",
      cookingRole: "starch",
      nutrition: `{
          "energy_kcal": 340, "fat": 1.3, "saturated_fat": 0.2,
          "carbohydrates": 75, "sugars": 1.5, "fibre": 3.1,
          "protein": 10, "salt": 0, "nutrition_grade": "b"
        }`,
      stockAmount: 2,
      stockNote: "",
      bestBefore: "2026-11-01",
      price: 2.4,
    },
  ];

  type ResolvedArchetype = Archetype & {
    stockUnit: string;
    purchaseUnit: string;
    location: string;
    group: string;
  };
  const archetype: ResolvedArchetype | null = (() => {
    for (const a of ARCHETYPES) {
      const stockUnit = findFirst(units, a.stockUnitPrefs);
      const purchaseUnit = findFirst(units, a.purchaseUnitPrefs);
      const location = findFirst(locations, a.locationPrefs);
      const group = findFirst(groups, a.groupPrefs);
      if (stockUnit && purchaseUnit && stockUnit !== purchaseUnit && location && group) {
        return { ...a, stockUnit, purchaseUnit, location, group };
      }
    }
    return null;
  })();

  lines.push("## Examples");
  lines.push("");
  lines.push("### Example A — receipt line (minimal product block)");
  lines.push("");
  lines.push("```json");
  lines.push(`{
  "version": "1",
  "items": [
    {
      "product": {
        "name": "Semi-skimmed Milk",
        "brand": "${exA_store}",
        "barcode": "5000436589217"
      },
      "stock": {
        "amount": 2, "unit_name": "${exA_unit}", "best_before_date": "2026-05-10",
        "price": 2.40, "store_name": "${exA_store}", "location_name": "${exA_location}"
      }
    }
  ]
}`);
  lines.push("```");
  lines.push("");

  if (archetype) {
    lines.push("### Example B — packaging photo (full product block)");
    lines.push("");
    lines.push("```json");
    lines.push(`{
  "version": "1",
  "items": [
    {
      "product": {
        "name": "${archetype.name}",
        "brand": "${archetype.brand}",
        "barcode": "${archetype.barcode}",
        "qu_stock_name": "${archetype.stockUnit}",
        "qu_purchase_name": "${archetype.purchaseUnit}",
        "purchase_to_stock_factor": ${archetype.purchaseToStockFactor},
        "location_name": "${archetype.location}",
        "shopping_location_name": "${exA_store}",
        "product_group_name": "${archetype.group}",
        "default_due_days": ${archetype.defaultDueDays},
        "due_type": "${archetype.dueType}",
        "cooking_role": "${archetype.cookingRole}",
        "nutrition": ${archetype.nutrition}
      },
      "stock": {
        "amount": ${archetype.stockAmount}, "unit_name": "${archetype.purchaseUnit}", "best_before_date": "${archetype.bestBefore}",
        "price": ${archetype.price}, "store_name": "${exA_store}", "location_name": "${archetype.location}"${archetype.stockNote ? `,\n        "note": "${archetype.stockNote}"` : ""}
      }
    }
  ]
}`);
    lines.push("```");
    lines.push("");
  } else {
    lines.push(
      "_(No full-product example generated — your master-data doesn't yet " +
        "contain a coherent unit/location/group combination for a canned / " +
        "bottled / bagged archetype. For packaging photos, fill every field " +
        "from the schema using values from the master-data tables above.)_",
    );
    lines.push("");
  }

  lines.push(
    "Now wait for my photo(s) or receipt, then reply with the JSON object only.",
  );

  return lines.join("\n");
}
