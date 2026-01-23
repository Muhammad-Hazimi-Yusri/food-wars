const STORAGE_KEY = "food-wars-guest";

export type GuestData = {
  inventory: InventoryItem[];
  shoppingList: ShoppingItem[];
};

export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: "fridge" | "freezer" | "pantry" | "spices";
  expiryDate: string | null;
  createdAt: string;
};

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
};

const defaultData: GuestData = {
  inventory: [],
  shoppingList: [],
};

export function getGuestData(): GuestData {
  if (typeof window === "undefined") return defaultData;
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return defaultData;
  
  try {
    return JSON.parse(stored);
  } catch {
    return defaultData;
  }
}

export function setGuestData(data: GuestData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearGuestData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}