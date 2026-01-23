"use client";

import { useGuestStorage } from "@/hooks/useGuestStorage";
import { Button } from "@/components/ui/button";

export function GuestStorageTest() {
  const { inventory, isLoaded, addInventoryItem, removeInventoryItem } = useGuestStorage();

  if (!isLoaded) return <p>Loading...</p>;

  const handleAdd = () => {
    addInventoryItem({
      name: "Test Item " + (inventory.length + 1),
      quantity: 1,
      unit: "pc",
      category: "fridge",
      expiryDate: null,
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Guest Storage Test</h2>
      <Button onClick={handleAdd}>Add Test Item</Button>
      <ul className="space-y-2">
        {inventory.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <span>{item.name}</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => removeInventoryItem(item.id)}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      {inventory.length === 0 && <p className="text-muted-foreground">No items yet</p>}
    </div>
  );
}