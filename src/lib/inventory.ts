import { createClient } from "@/lib/supabase/client";
import type { InventoryItem, ItemCategory } from "@/types/database";

export type NewInventoryItem = {
  name: string;
  quantity: number;
  unit: string;
  category: ItemCategory;
  expiry_date: string | null;
};

const GUEST_STORAGE_KEY = "food-wars-inventory";

// Helper to check if user is signed in
async function getAuthState() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

// Helper for guest storage
function getGuestItems(): InventoryItem[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(GUEST_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function setGuestItems(items: InventoryItem[]) {
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(items));
}

// CRUD operations
export async function getInventoryItems(): Promise<InventoryItem[]> {
  const { supabase, user } = await getAuthState();

  if (!user) {
    return getGuestItems();
  }

  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createInventoryItem(
  item: NewInventoryItem
): Promise<InventoryItem> {
  const { supabase, user } = await getAuthState();

  if (!user) {
    // Guest mode
    const newItem: InventoryItem = {
      id: crypto.randomUUID(),
      household_id: "guest",
      ...item,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const items = getGuestItems();
    setGuestItems([newItem, ...items]);
    return newItem;
  }

  // Get user's household
  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("id")
    .limit(1)
    .single();

  if (householdError || !household) {
    throw new Error("No household found");
  }

  const { data, error } = await supabase
    .from("inventory_items")
    .insert({ ...item, household_id: household.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateInventoryItem(
  id: string,
  updates: Partial<NewInventoryItem>
): Promise<InventoryItem> {
  const { supabase, user } = await getAuthState();

  if (!user) {
    const items = getGuestItems();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) throw new Error("Item not found");

    const updated = {
      ...items[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    items[index] = updated;
    setGuestItems(items);
    return updated;
  }

  const { data, error } = await supabase
    .from("inventory_items")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const { supabase, user } = await getAuthState();

  if (!user) {
    const items = getGuestItems();
    setGuestItems(items.filter((item) => item.id !== id));
    return;
  }

  const { error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", id);

  if (error) throw error;
}