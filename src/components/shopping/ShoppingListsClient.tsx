"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, ShoppingCart, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getHouseholdId } from "@/lib/supabase/get-household";
import { toast } from "sonner";
import type { ShoppingList } from "@/types/database";

type Props = {
  lists: ShoppingList[];
};

export function ShoppingListsClient({ lists: initialLists }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingList, setEditingList] = useState<ShoppingList | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openCreate = () => {
    setEditingList(null);
    setName("");
    setDescription("");
    setShowForm(true);
  };

  const openEdit = (list: ShoppingList, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingList(list);
    setName(list.name);
    setDescription(list.description ?? "");
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    try {
      const supabase = createClient();
      const household = await getHouseholdId(supabase);
      if (!household.success) throw new Error(household.error);

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
      };

      if (editingList) {
        const { error } = await supabase
          .from("shopping_lists")
          .update(payload)
          .eq("id", editingList.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("shopping_lists")
          .insert({ ...payload, household_id: household.householdId });
        if (error) throw error;
      }

      setShowForm(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save list");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (list: ShoppingList, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(list.id);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("shopping_lists")
        .delete()
        .eq("id", list.id);
      if (error) throw error;

      toast(`Deleted "${list.name}"`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete list");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleAutoTarget = async (list: ShoppingList, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const supabase = createClient();
      const household = await getHouseholdId(supabase);
      if (!household.success) throw new Error(household.error);

      if (!list.is_auto_target) {
        // Clear any existing auto-target in this household first
        await supabase
          .from("shopping_lists")
          .update({ is_auto_target: false })
          .eq("household_id", household.householdId)
          .eq("is_auto_target", true);
      }

      const { error } = await supabase
        .from("shopping_lists")
        .update({ is_auto_target: !list.is_auto_target })
        .eq("id", list.id);
      if (error) throw error;

      toast(list.is_auto_target ? "Auto-add disabled" : `"${list.name}" set as auto-add target`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display text-megumi">Shopping Lists</h1>
          <p className="text-sm text-gray-500 mt-1">
            {initialLists.length} {initialLists.length === 1 ? "list" : "lists"}
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New List
        </Button>
      </div>

      {/* Lists */}
      {initialLists.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No shopping lists yet</p>
          <p className="text-sm mt-1">Create your first list to start shopping</p>
          <Button onClick={openCreate} size="sm" className="mt-4">
            <Plus className="h-4 w-4 mr-1" />
            New List
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {initialLists.map((list) => (
            <Link
              key={list.id}
              href={`/shopping-lists/${list.id}`}
              className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-megumi hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium text-gray-900 truncate">{list.name}</h2>
                    {list.is_auto_target && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-soma/10 text-soma-dark">
                        <Zap className="h-3 w-3" />
                        Auto-add
                      </span>
                    )}
                  </div>
                  {list.description && (
                    <p className="text-sm text-gray-500 mt-1 truncate">{list.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => handleToggleAutoTarget(list, e)}
                    title={list.is_auto_target ? "Disable auto-add" : "Set as auto-add target"}
                  >
                    <Zap className={`h-4 w-4 ${list.is_auto_target ? "text-soma-dark" : "text-gray-400"}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => openEdit(list, e)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => handleDelete(list, e)}
                    disabled={deletingId === list.id}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(isOpen) => !isOpen && setShowForm(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingList ? "Edit List" : "New Shopping List"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="list-name">Name</Label>
              <Input
                id="list-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekly groceries"
                required
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="list-description">Description (optional)</Label>
              <Input
                id="list-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. For Saturday market run"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? "Saving..." : editingList ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
