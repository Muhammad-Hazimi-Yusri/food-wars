"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getGuestData,
  setGuestData,
  GuestData,
  InventoryItem,
} from "@/lib/storage";

function getInitialData(): GuestData {
  if (typeof window === "undefined") {
    return { inventory: [], shoppingList: [] };
  }
  return getGuestData();
}

export function useGuestStorage() {
  const [data, setData] = useState<GuestData>(getInitialData);

  // Save to localStorage whenever data changes
  useEffect(() => {
    setGuestData(data);
  }, [data]);

  const addInventoryItem = useCallback((item: Omit<InventoryItem, "id" | "createdAt">) => {
    const newItem: InventoryItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({
      ...prev,
      inventory: [...prev.inventory, newItem],
    }));
  }, []);

  const removeInventoryItem = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      inventory: prev.inventory.filter((item) => item.id !== id),
    }));
  }, []);

  return {
    inventory: data.inventory,
    shoppingList: data.shoppingList,
    isLoaded: true,
    addInventoryItem,
    removeInventoryItem,
  };
}