export type ItemCategory = "fridge" | "freezer" | "pantry" | "spices";

export type Household = {
  id: string;
  name: string;
  created_at: string;
  owner_id: string;
};

export type InventoryItem = {
  id: string;
  household_id: string;
  name: string;
  quantity: number;
  unit: string;
  category: ItemCategory;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
};