"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WoodCard } from "@/components/diner/WoodCard";
import { AddItemForm } from "@/components/inventory/AdditemForm";
import { EditItemForm } from "@/components/inventory/EditItemForm";
import { getInventoryItems, deleteInventoryItem } from "@/lib/inventory";
import type { InventoryItem } from "@/types/database";
import { getInventoryStats } from "@/lib/inventory-utils";
import { InventoryWarnings } from "@/components/inventory/InventoryWarning";
import { InventoryStatsDisplay } from "@/components/inventory/InventoryStats";

export function InventoryList() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const fetchItems = async () => {
    try {
      const data = await getInventoryItems();
      setItems(data);
    } catch (error) {
      console.error("Failed to fetch items:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteInventoryItem(id);
      setItems(items.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  const handleAddSuccess = () => {
    setAddDialogOpen(false);
    fetchItems();
  };

  const handleEditSuccess = () => {
    setEditingItem(null);
    fetchItems();
  };

  const stats = getInventoryStats(items);

  if (loading) {
    return <p className="text-muted-foreground">Loading inventory...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-megumi">
          Your Kitchen 台所
        </h2>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Inventory</DialogTitle>
            </DialogHeader>
            <AddItemForm onSuccess={handleAddSuccess} />
          </DialogContent>
        </Dialog>
      </div>

      <InventoryWarnings stats={stats} />
      <InventoryStatsDisplay stats={stats} />

      {items.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          Your kitchen is empty. Add some items!
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <WoodCard
              key={item.id}
              item={item}
              onEdit={setEditingItem}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <EditItemForm
              item={editingItem}
              onSuccess={handleEditSuccess}
              onCancel={() => setEditingItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}