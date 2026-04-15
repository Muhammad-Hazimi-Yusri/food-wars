"use server";

import { createClient } from "@/lib/supabase/server";
import {
  buildInventoryItems,
  formatInventoryPreamble,
  resolveCurrentHouseholdId,
} from "@/lib/inventory-export-core";

/**
 * Server action used by the in-app "Export for AI" clipboard button.
 * Thin wrapper around the shared helpers in `inventory-export-core.ts`
 * so the core can also be imported by API routes without the
 * `"use server"` directive constraints (serializable args only).
 */
export async function exportInventoryForAI(): Promise<{
  success: boolean;
  text?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const householdId = await resolveCurrentHouseholdId(supabase);
  if (!householdId) {
    return { success: false, error: "Not authenticated" };
  }

  const { items, today, error } = await buildInventoryItems(supabase, householdId);
  if (error) {
    return { success: false, error };
  }

  return { success: true, text: formatInventoryPreamble(items, today) };
}
