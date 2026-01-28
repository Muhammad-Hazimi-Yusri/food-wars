"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, GripVertical, Snowflake } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { MasterDataForm, FieldConfig } from "./MasterDataForm";
import { Location, QuantityUnit } from "@/types/database";

type BaseItem = {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
  description?: string | null;
};

type MasterDataListProps<T extends BaseItem> = {
  table: string;
  title: string;
  titlePlural: string;
  items: T[];
  fields: FieldConfig[];
  entityType: "location" | "product_group" | "quantity_unit" | "shopping_location";
};

export function MasterDataList<T extends BaseItem>({
  table,
  title,
  titlePlural,
  items,
  fields,
  entityType,
}: MasterDataListProps<T>) {
  const router = useRouter();
  const [editItem, setEditItem] = useState<T | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const handleDelete = async (item: T) => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;

    setDeleting(item.id);
    try {
      const supabase = createClient();
      const { error } = await supabase.from(table).delete().eq("id", item.id);
      if (error) throw error;
      router.refresh();
    } catch {
      alert("Failed to delete. It may be in use by products.");
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (item: T) => {
    setToggling(item.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from(table)
        .update({ active: !item.active })
        .eq("id", item.id);
      if (error) throw error;
      router.refresh();
    } catch {
      alert("Failed to toggle status");
    } finally {
      setToggling(null);
    }
  };

  const handleEdit = (item: T) => {
    setEditItem(item);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditItem(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditItem(null);
  };

  // Render badges based on entity type
  const renderBadges = (item: T) => {
    if (entityType === "location") {
      const loc = item as unknown as Location;
      if (loc.is_freezer) {
        return (
          <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
            <Snowflake className="h-3 w-3" />
            Freezer
          </span>
        );
      }
    }
    return null;
  };

  // Render subtitle based on entity type
  const renderSubtitle = (item: T) => {
    if (entityType === "quantity_unit") {
      const qu = item as unknown as QuantityUnit;
      if (qu.name_plural) {
        return `Plural: ${qu.name_plural}`;
      }
    }
    return item.description || null;
  };

  const activeItems = items.filter((i) => i.active);
  const inactiveItems = items.filter((i) => !i.active);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{titlePlural}</h1>
        <Button onClick={handleAdd} className="bg-soma hover:bg-soma/90">
          <Plus className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Add {title}</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Stats */}
      <p className="text-sm text-gray-500 mb-4">
        {activeItems.length} active, {inactiveItems.length} inactive
      </p>

      {/* List */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <p className="text-gray-500">No {titlePlural.toLowerCase()} yet.</p>
            <Button onClick={handleAdd} variant="link" className="mt-2">
              Add your first {title.toLowerCase()}
            </Button>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm",
                !item.active && "opacity-60"
              )}
            >
              {/* Drag handle (future) */}
              <GripVertical className="h-4 w-4 text-gray-300 hidden sm:block cursor-grab" />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("font-medium", !item.active && "line-through text-gray-500")}>
                    {item.name}
                  </span>
                  {renderBadges(item)}
                  {!item.active && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                      inactive
                    </span>
                  )}
                </div>
                {renderSubtitle(item) && (
                  <div className="text-sm text-gray-500 truncate">{renderSubtitle(item)}</div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-blue-600"
                  onClick={() => handleEdit(item)}
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8",
                    item.active
                      ? "text-green-600 hover:text-gray-600"
                      : "text-gray-400 hover:text-green-600"
                  )}
                  onClick={() => handleToggleActive(item)}
                  disabled={toggling === item.id}
                  title={item.active ? "Deactivate" : "Activate"}
                >
                  {item.active ? (
                    <ToggleRight className="h-4 w-4" />
                  ) : (
                    <ToggleLeft className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-red-600"
                  onClick={() => handleDelete(item)}
                  disabled={deleting === item.id}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form Modal */}
      <MasterDataForm
        table={table}
        title={title}
        fields={fields}
        item={editItem as Record<string, unknown> | null}
        open={showForm}
        onClose={handleCloseForm}
      />
    </>
  );
}