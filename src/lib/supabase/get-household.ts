import { GUEST_HOUSEHOLD_ID } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';

type HouseholdResult =
  | { success: true; householdId: string; userId: string }
  | { success: false; error: string };

/**
 * Get the current user's household ID.
 * Handles both authenticated users (query households table) and
 * guest mode (returns GUEST_HOUSEHOLD_ID).
 *
 * Accepts an optional supabase client to avoid creating a new one.
 */
export async function getHouseholdId(
  supabase?: ReturnType<typeof createClient>
): Promise<HouseholdResult> {
  const client = supabase ?? createClient();

  const { data: { user } } = await client.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  if (user.is_anonymous === true) {
    return { success: true, householdId: GUEST_HOUSEHOLD_ID, userId: user.id };
  }

  const { data: household } = await client
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!household) return { success: false, error: 'No household found' };

  return { success: true, householdId: household.id, userId: user.id };
}
