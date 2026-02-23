/**
 * Built-in SI unit conversions, keyed by unit name (case-sensitive, matching seeded names).
 * Users never need to create DB conversion entries for these pairs.
 * Non-SI units (bottle, can, pint) still require a product-specific DB conversion
 * to link them to their SI base unit.
 */
const BUILT_IN_CONVERSIONS: Record<string, Record<string, number>> = {
  // Mass
  kg: { g: 1000 },
  g: { kg: 0.001 },
  // Volume
  L: { mL: 1000 },
  mL: { L: 0.001, pint: 1 / 568.261 },
  pint: { mL: 568.261 },
};

/**
 * Returns the conversion factor from one unit name to another if a built-in
 * SI relationship exists, or null if none is known.
 */
export function resolveBuiltInConversion(
  fromName: string,
  toName: string,
): number | null {
  return BUILT_IN_CONVERSIONS[fromName]?.[toName] ?? null;
}

/**
 * Scales a price-per-stock-unit to a human-readable display unit.
 * UK food labelling convention: per 100 mL / per 100 g.
 * All other units are returned unchanged.
 */
export function getSmartPriceDisplay(
  pricePerStockUnit: number,
  unitName: string,
): { scaledPrice: number; displayUnit: string } {
  if (unitName === "mL") {
    return { scaledPrice: pricePerStockUnit * 100, displayUnit: "100mL" };
  }
  if (unitName === "g") {
    return { scaledPrice: pricePerStockUnit * 100, displayUnit: "100g" };
  }
  return { scaledPrice: pricePerStockUnit, displayUnit: unitName };
}
