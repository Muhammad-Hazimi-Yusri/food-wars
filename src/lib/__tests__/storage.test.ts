import { describe, it, expect, beforeEach } from "vitest";
import { getGuestData, setGuestData, clearGuestData } from "../storage";

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default data when empty", () => {
    const data = getGuestData();
    expect(data.inventory).toEqual([]);
    expect(data.shoppingList).toEqual([]);
  });

  it("saves and retrieves data", () => {
    const testData = {
      inventory: [
        {
          id: "1",
          name: "Eggs",
          quantity: 6,
          unit: "pc",
          category: "fridge" as const,
          expiryDate: null,
          createdAt: new Date().toISOString(),
        },
      ],
      shoppingList: [],
    };

    setGuestData(testData);
    const retrieved = getGuestData();

    expect(retrieved.inventory).toHaveLength(1);
    expect(retrieved.inventory[0].name).toBe("Eggs");
  });

  it("clears data", () => {
    setGuestData({ inventory: [], shoppingList: [] });
    clearGuestData();
    const data = getGuestData();
    expect(data.inventory).toEqual([]);
  });
});