"use server";

import { createClient } from "@/lib/supabase/server";
import type { CookingRole } from "@/types/database";

type ActionResult = {
  success: boolean;
  error?: string;
};

/**
 * Update the cooking_role for a product. Pass null to clear.
 */
export async function updateCookingRole(
  productId: string,
  role: CookingRole | null
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase
      .from("products")
      .update({ cooking_role: role })
      .eq("id", productId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update cooking role",
    };
  }
}
