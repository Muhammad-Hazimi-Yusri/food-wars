"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, GripVertical, Snowflake } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { MasterDataForm, FieldConfig } from "./MasterDataForm";
import { Location, QuantityUnit } from "@/types/database";

// Sortable item wrapper
function SortableItem({
  id,
  children,
}: {
  id: string;
  children: (props: {
    attributes: ReturnType<typeof useSortable>["attributes"];
    listeners: ReturnType<typeof useSortable>["listeners"];
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

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
  const [localItems, setLocalItems] = useState<T[]>(items);
  const [saving, setSaving] = useState(false);

  // Sync local items when props change
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  // Sensors: pointer (mouse), touch with delay, keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = localItems.findIndex((item) => item.id === active.id);
    const newIndex = localItems.findIndex((item) => item.id === over.id);

    const newItems = arrayMove(localItems, oldIndex, newIndex);
    setLocalItems(newItems);

    // Save new sort order to database
    setSaving(true);
    try {
      const supabase = createClient();
      const updates = newItems.map((item, index) => ({
        id: item.id,
        sort_order: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from(table)
          .update({ sort_order: update.sort_order })
          .eq("id", update.id);
        if (error) throw error;
      }

      router.refresh();
    } catch {
      // Revert on error
      setLocalItems(items);
      alert("Failed to save order");
    } finally {
      setSaving(false);
    }
  };

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

  const activeItems = localItems.filter((i) => i.active);
  const inactiveItems = localItems.filter((i) => !i.active);

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
        {saving && <span className="ml-2 text-blue-600">Saving...</span>}
      </p>

      {/* List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localItems.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {localItems.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <p className="text-gray-500">No {titlePlural.toLowerCase()} yet.</p>
                <Button onClick={handleAdd} variant="link" className="mt-2">
                  Add your first {title.toLowerCase()}
                </Button>
              </div>
            ) : (
              localItems.map((item) => (
                <SortableItem key={item.id} id={item.id}>
                  {({ attributes, listeners, isDragging }) => (
                    <div
                      className={cn(
                        "flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm",
                        !item.active && "opacity-60",
                        isDragging && "shadow-lg ring-2 ring-soma/20"
                      )}
                    >
                      {/* Drag handle */}
                      <button
                        type="button"
                        className="touch-none text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                        {...attributes}
                        {...listeners}
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>

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
                  )}
                </SortableItem>
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

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