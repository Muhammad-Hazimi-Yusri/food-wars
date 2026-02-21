/**
 * Pure utility functions for recipe calculations.
 * No Supabase or server-side dependencies — safe to import in client components.
 */

export function scaleAmount(
  amount: number,
  baseServings: number,
  desiredServings: number
): number {
  if (baseServings <= 0) return amount;
  return amount * (desiredServings / baseServings);
}

export function formatScaledAmount(scaled: number): string {
  // Round to at most 2 decimal places, drop trailing zeros
  return parseFloat(scaled.toFixed(2)).toString();
}
