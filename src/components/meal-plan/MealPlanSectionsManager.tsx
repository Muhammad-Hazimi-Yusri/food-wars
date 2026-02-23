"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addMealPlanSection,
  updateMealPlanSection,
  removeMealPlanSection,
  reorderMealPlanSections,
} from "@/lib/meal-plan-actions";
import type { MealPlanSection } from "@/types/database";

// ---------------------------------------------------------------------------
// SortableSectionRow
// ---------------------------------------------------------------------------

function SortableSectionRow({
  section,
  onSave,
  onDelete,
}: {
  section: MealPlanSection;
  onSave: (id: string, name: string, time: string | null) => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.name);
  const [time, setTime] = useState(section.time?.slice(0, 5) ?? "");
  const [saving, setSaving] = useState(false);

  // Initialise edit state from current props when entering edit mode
  const handleStartEdit = () => {
    setName(section.name);
    setTime(section.time?.slice(0, 5) ?? "");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(section.id, name.trim(), time || null);
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        "flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2",
        isDragging ? "opacity-50 shadow-lg" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {editing ? (
        <>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-sm flex-1 min-w-0"
            placeholder="Section name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
          />
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-7 text-sm w-24 shrink-0"
          />
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="text-green-600 hover:text-green-700 disabled:opacity-40 shrink-0"
            aria-label="Save"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={handleCancel}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 min-w-0 text-sm font-medium text-megumi truncate">
            {section.name}
          </span>
          {section.time && (
            <span className="text-xs text-muted-foreground shrink-0">
              {section.time.slice(0, 5)}
            </span>
          )}
          <button
            onClick={handleStartEdit}
            className="text-muted-foreground hover:text-soma shrink-0 transition-colors"
            aria-label={`Edit ${section.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(section.id, section.name)}
            className="text-muted-foreground hover:text-destructive shrink-0 transition-colors"
            aria-label={`Delete ${section.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MealPlanSectionsManager
// ---------------------------------------------------------------------------

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: MealPlanSection[];
};

export function MealPlanSectionsManager({ open, onOpenChange, sections }: Props) {
  const router = useRouter();
  const [localSections, setLocalSections] = useState<MealPlanSection[]>(sections);
  const [newName, setNewName] = useState("");
  const [newTime, setNewTime] = useState("");
  const [adding, setAdding] = useState(false);

  // Sync when server re-renders
  useEffect(() => {
    setLocalSections(sections);
  }, [sections]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localSections.findIndex((s) => s.id === active.id);
    const newIndex = localSections.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(localSections, oldIndex, newIndex);

    setLocalSections(reordered);

    const result = await reorderMealPlanSections(reordered.map((s) => s.id));
    if (!result.success) {
      setLocalSections(sections);
      toast.error("Failed to reorder sections.");
    } else {
      router.refresh();
    }
  };

  const handleSave = async (id: string, name: string, time: string | null) => {
    const result = await updateMealPlanSection(id, { name, time });
    if (!result.success) {
      toast.error(result.error ?? "Failed to update section.");
    } else {
      setLocalSections((prev) =>
        prev.map((s) => (s.id === id ? { ...s, name, time: time ?? null } : s))
      );
      router.refresh();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const result = await removeMealPlanSection(id);
    if (!result.success) {
      toast.error(result.error ?? "Failed to delete section.");
    } else {
      setLocalSections((prev) => prev.filter((s) => s.id !== id));
      toast(`"${name}" deleted. Any meals in this section moved to Other.`);
      router.refresh();
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    const result = await addMealPlanSection({
      name: newName.trim(),
      time: newTime || null,
    });
    setAdding(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to add section.");
    } else {
      setNewName("");
      setNewTime("");
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Meal Sections</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sortable list */}
          {localSections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No sections yet. Add one below.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localSections.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1.5">
                  {localSections.map((section) => (
                    <SortableSectionRow
                      key={section.id}
                      section={section}
                      onSave={handleSave}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Add new section */}
          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Add section
            </p>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name (e.g. Snack)"
                className="h-8 text-sm flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
              <Input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="h-8 text-sm w-24 shrink-0"
                title="Optional time"
              />
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={adding || !newName.trim()}
                className="h-8 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
