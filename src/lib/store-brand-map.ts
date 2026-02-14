/**
 * Maps known store-brand prefixes to canonical store names.
 * Used to detect store brands from the OFF `brands` field
 * and suggest the matching shopping_location.
 *
 * Key: lowercase brand prefix to match against OFF brands string.
 * Value: canonical store name to fuzzy-match against shopping_locations.name.
 *
 * Longer prefixes are listed first so "tesco finest" matches before "tesco".
 */
export const STORE_BRAND_MAP: [prefix: string, store: string][] = [
  // Tesco sub-brands first (longest match wins)
  ["tesco finest", "Tesco"],
  ["tesco everyday value", "Tesco"],
  ["tesco", "Tesco"],
  // Sainsbury's sub-brands
  ["sainsbury's taste the difference", "Sainsbury's"],
  ["sainsbury's", "Sainsbury's"],
  ["sainsbury", "Sainsbury's"],
  // Asda sub-brands
  ["asda extra special", "Asda"],
  ["asda", "Asda"],
  // M&S sub-brands
  ["marks & spencer", "M&S"],
  ["m&s", "M&S"],
  // Other UK stores
  ["aldi", "Aldi"],
  ["lidl", "Lidl"],
  ["morrisons", "Morrisons"],
  ["waitrose", "Waitrose"],
  ["co-op", "Co-op"],
  ["iceland", "Iceland"],
  ["spar", "Spar"],
];

/**
 * Given an OFF brands string, detect if it's a store brand
 * and return the canonical store name, or null.
 */
export function detectStoreBrand(brands: string): string | null {
  if (!brands) return null;
  const lower = brands.toLowerCase();
  for (const [prefix, store] of STORE_BRAND_MAP) {
    if (lower.startsWith(prefix) || lower.includes(prefix)) {
      return store;
    }
  }
  return null;
}
