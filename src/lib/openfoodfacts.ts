export type OFFNutriments = {
  energy_kj_100g: number | null;
  energy_kcal_100g: number | null;
  fat_100g: number | null;
  saturated_fat_100g: number | null;
  carbohydrates_100g: number | null;
  sugars_100g: number | null;
  fiber_100g: number | null;
  proteins_100g: number | null;
  salt_100g: number | null;
};

export type OFFProduct = {
  name: string;
  imageUrl: string | null;
  brands: string | null;
  quantity: string | null;
  barcode: string;
  nutriments: OFFNutriments | null;
  nutritionGrade: string | null;
  categories: string | null;
  ingredientsText: string | null;
  stores: string | null;
};

const OFF_API_BASE = "https://world.openfoodfacts.org/api/v2/product";

export type OFFLookupResult =
  | { found: true; product: OFFProduct }
  | { found: false; reason: "not_found" | "network_error" };

const OFF_FIELDS = [
  "product_name",
  "product_name_en",
  "image_front_url",
  "image_front_small_url",
  "brands",
  "quantity",
  "nutriments",
  "nutrition_grades",
  "categories",
  "ingredients_text",
  "stores",
].join(",");

function parseNutriments(
  raw: Record<string, unknown> | undefined
): OFFNutriments | null {
  if (!raw || typeof raw !== "object") return null;

  const num = (key: string): number | null => {
    const v = raw[key];
    return typeof v === "number" ? v : null;
  };

  const result = {
    energy_kj_100g: num("energy-kj_100g"),
    energy_kcal_100g: num("energy-kcal_100g"),
    fat_100g: num("fat_100g"),
    saturated_fat_100g: num("saturated-fat_100g"),
    carbohydrates_100g: num("carbohydrates_100g"),
    sugars_100g: num("sugars_100g"),
    fiber_100g: num("fiber_100g"),
    proteins_100g: num("proteins_100g"),
    salt_100g: num("salt_100g"),
  };

  // If every value is null the product has no real nutrition data
  const hasAnyValue = Object.values(result).some((v) => v !== null);
  return hasAnyValue ? result : null;
}

async function fetchOFF(barcode: string): Promise<OFFLookupResult> {
  const res = await fetch(
    `${OFF_API_BASE}/${barcode}.json?fields=${OFF_FIELDS}`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) return { found: false, reason: "not_found" };

  const data = await res.json();
  if (data.status !== 1 || !data.product) return { found: false, reason: "not_found" };

  const p = data.product;
  return {
    found: true,
    product: {
      name: p.product_name || p.product_name_en || "",
      imageUrl: p.image_front_url || p.image_front_small_url || null,
      brands: p.brands || null,
      quantity: p.quantity || null,
      barcode,
      nutriments: parseNutriments(p.nutriments),
      nutritionGrade: p.nutrition_grades || null,
      categories: p.categories || null,
      ingredientsText: p.ingredients_text || null,
      stores: p.stores || null,
    },
  };
}

/**
 * Look up a barcode on Open Food Facts with a typed result distinguishing
 * "not found" from "network error". Retries once on network failures.
 */
export async function lookupBarcodeOFFStatus(
  barcode: string
): Promise<OFFLookupResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fetchOFF(barcode);
    } catch {
      if (attempt === 1) return { found: false, reason: "network_error" };
    }
  }
  return { found: false, reason: "network_error" };
}

/**
 * Look up a barcode on Open Food Facts.
 * Returns product info if found, null otherwise.
 * Never throws — returns null on any error.
 */
export async function lookupBarcodeOFF(
  barcode: string
): Promise<OFFProduct | null> {
  const result = await lookupBarcodeOFFStatus(barcode);
  return result.found ? result.product : null;
}

/**
 * Map OFF nutriments to our product_nutrition schema fields.
 * Returns an object ready for Supabase insert (minus id, household_id, product_id, timestamps).
 */
export function mapOFFNutrimentsToNutrition(
  nutriments: OFFNutriments,
  nutritionGrade: string | null
) {
  return {
    energy_kj: nutriments.energy_kj_100g,
    energy_kcal: nutriments.energy_kcal_100g,
    fat: nutriments.fat_100g,
    saturated_fat: nutriments.saturated_fat_100g,
    carbohydrates: nutriments.carbohydrates_100g,
    sugars: nutriments.sugars_100g,
    fibre: nutriments.fiber_100g,
    protein: nutriments.proteins_100g,
    salt: nutriments.salt_100g,
    nutrition_grade: nutritionGrade,
    data_source: "off" as const,
  };
}

/**
 * Download an OFF product image and return it as a File.
 * Returns null on any error. Used to persist OFF images to Supabase storage.
 */
export async function downloadOffImage(
  url: string
): Promise<File | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const blob = await res.blob();
    const ext = blob.type === "image/png" ? "png" : "jpg";
    return new File([blob], `off-product.${ext}`, { type: blob.type });
  } catch {
    return null;
  }
}
