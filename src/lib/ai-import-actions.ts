"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveCurrentHouseholdId } from "@/lib/inventory-export-core";
import { buildImportContextBundle } from "@/lib/ai-context-export";
import {
  lookupBarcodeOFF,
  mapOFFNutrimentsToNutrition,
} from "@/lib/openfoodfacts";
import { downloadAndUploadOffImage } from "@/lib/product-actions";
import type { ImportNutrition } from "@/types/ai-import";

// ============================================
// Context bundle (server action)
// ============================================

export type ImportContextResult =
  | { success: true; text: string }
  | { success: false; error: string };

/**
 * Server action for the "Export AI context" button. Queries the current
 * household's master-data and returns a ready-to-paste markdown bundle.
 */
export async function getImportContextAction(): Promise<ImportContextResult> {
  const supabase = await createClient();
  const householdId = await resolveCurrentHouseholdId(supabase);
  if (!householdId) {
    return { success: false, error: "Not authenticated" };
  }
  const text = await buildImportContextBundle(supabase, householdId);
  return { success: true, text };
}

// ============================================
// OFF nutrition enrichment (server action)
// ============================================

export type OffEnrichmentResult =
  | { success: true; nutrition: ImportNutrition | null; brand: string | null; imageUrl: string | null }
  | { success: false; error: string };

/**
 * Look up a barcode on Open Food Facts and return fields the review UI
 * can merge into a pending new-product item.
 */
export async function fetchOffEnrichmentAction(
  barcode: string,
): Promise<OffEnrichmentResult> {
  if (!barcode.trim()) return { success: false, error: "No barcode" };
  const off = await lookupBarcodeOFF(barcode.trim());
  if (!off) return { success: false, error: "Not found on Open Food Facts" };

  let nutrition: ImportNutrition | null = null;
  if (off.nutriments) {
    const mapped = mapOFFNutrimentsToNutrition(off.nutriments, off.nutritionGrade);
    nutrition = {
      energy_kj: mapped.energy_kj,
      energy_kcal: mapped.energy_kcal,
      fat: mapped.fat,
      saturated_fat: mapped.saturated_fat,
      carbohydrates: mapped.carbohydrates,
      sugars: mapped.sugars,
      fibre: mapped.fibre,
      protein: mapped.protein,
      salt: mapped.salt,
      nutrition_grade: mapped.nutrition_grade,
    };
  }

  return {
    success: true,
    nutrition,
    brand: off.brands,
    imageUrl: off.imageUrl,
  };
}

// ============================================
// Picture upload for new product (server action wrapper)
// ============================================

/**
 * Download an image from a URL and persist it to product-pictures storage.
 * Exposed as an async action so client code can attach an OFF image to a
 * newly-created product without fighting CORS.
 */
export async function attachOffImageAction(
  url: string,
): Promise<{ success: boolean; fileName?: string; error?: string }> {
  const supabase = await createClient();
  const householdId = await resolveCurrentHouseholdId(supabase);
  if (!householdId) return { success: false, error: "Not authenticated" };
  const fileName = await downloadAndUploadOffImage(url, householdId);
  if (!fileName) return { success: false, error: "Image download failed" };
  return { success: true, fileName };
}
