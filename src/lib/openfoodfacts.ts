export type OFFProduct = {
  name: string;
  imageUrl: string | null;
  brands: string | null;
  quantity: string | null;
  barcode: string;
};

const OFF_API_BASE = "https://world.openfoodfacts.org/api/v2/product";

/**
 * Look up a barcode on Open Food Facts.
 * Returns product info if found, null otherwise.
 * Never throws — returns null on any error.
 */
export async function lookupBarcodeOFF(
  barcode: string
): Promise<OFFProduct | null> {
  try {
    const res = await fetch(`${OFF_API_BASE}/${barcode}.json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    return {
      name: p.product_name || p.product_name_en || "",
      imageUrl: p.image_front_url || p.image_front_small_url || null,
      brands: p.brands || null,
      quantity: p.quantity || null,
      barcode,
    };
  } catch {
    return null;
  }
}
