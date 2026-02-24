"use client";

import React, { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MealPlanEntryCard } from "@/components/meal-plan/MealPlanEntryCard";
import type { MealPlanSection, MealPlanEntryWithRelations } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  weekDays: string[]; // 7 YYYY-MM-DD strings, Mon → Sun
  sections: MealPlanSection[];
  entries: MealPlanEntryWithRelations[]; // week's entries (may be locally mutated)
  fulfillmentByRecipeId: Record<string, boolean>;
  today: string; // YYYY-MM-DD for highlighting
  onAddEntry: (day: string, sectionId: string | null) => void;
  onDragEnd: (event: DragEndEvent) => void;
  kcalByDay?: Record<string, number>;
};

// ---------------------------------------------------------------------------
// Cell key helpers
// ---------------------------------------------------------------------------

function cellKey(day: string, sectionId: string | null): string {
  return `${day}|${sectionId ?? "__none__"}`;
}

function droppableId(day: string, sectionId: string | null): string {
  return `cell:${cellKey(day, sectionId)}`;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---------------------------------------------------------------------------
// DroppableCell — makes empty cells register as valid drop targets
// ---------------------------------------------------------------------------

function DroppableCell({
  day,
  sectionId,
  isToday,
  children,
}: {
  day: string;
  sectionId: string | null;
  isToday: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId(day, sectionId) });
  return (
    <div
      ref={setNodeRef}
      className={[
        "border-b border-r border-border p-1.5 min-h-[72px] last:border-r-0 space-y-1 transition-colors",
        isToday ? "bg-soma/5" : "",
        isOver ? "ring-2 ring-inset ring-soma/40" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableEntryChip — compact sortable card for the grid cells
// ---------------------------------------------------------------------------

function SortableEntryChip({
  entry,
  canMake,
}: {
  entry: MealPlanEntryWithRelations;
  canMake?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-40" : ""}
      {...attributes}
      {...listeners}
    >
      <MealPlanEntryCard entry={entry} compact canMake={canMake} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MealPlanWeekView
// ---------------------------------------------------------------------------

export function MealPlanWeekView({
  weekDays,
  sections,
  entries,
  fulfillmentByRecipeId,
  today,
  onAddEntry,
  onDragEnd,
  kcalByDay,
}: Props) {
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const activeEntry = entries.find((e) => e.id === activeEntryId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveEntryId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveEntryId(null);
    onDragEnd(event);
  };

  // Index: cellKey → sorted entries[]
  const entryIndex = useMemo(() => {
    const idx = new Map<string, MealPlanEntryWithRelations[]>();
    for (const entry of entries) {
      const key = cellKey(entry.day, entry.section_id);
      if (!idx.has(key)) idx.set(key, []);
      idx.get(key)!.push(entry);
    }
    for (const [, group] of idx) {
      group.sort((a, b) => a.sort_order - b.sort_order);
    }
    return idx;
  }, [entries]);

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `80px repeat(7, minmax(0, 1fr))`,
  };

  return (
    <DndContext
      id="meal-plan-week-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="rounded-lg border border-border overflow-hidden"
        style={gridStyle}
      >
        {/* ── Header row ─────────────────────────────────────────── */}
        <div className="border-b border-r border-border bg-muted/30 p-2" />
        {weekDays.map((day, i) => {
          const isToday = day === today;
          const dayNum = day.split("-")[2];
          return (
            <div
              key={day}
              className={`border-b border-r border-border p-2 text-center last:border-r-0 ${
                isToday ? "bg-soma/5" : "bg-muted/20"
              }`}
            >
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                {DAY_LABELS[i]}
              </p>
              <p
                className={`text-lg font-bold leading-tight ${
                  isToday ? "text-soma" : "text-megumi"
                }`}
              >
                {dayNum}
              </p>
              {kcalByDay?.[day] != null && (
                <p className="text-[10px] text-muted-foreground leading-tight">
                  ~{kcalByDay[day].toLocaleString()}
                </p>
              )}
            </div>
          );
        })}

        {/* ── Section rows ───────────────────────────────────────── */}
        {sections.map((section) => (
          <React.Fragment key={section.id}>
            {/* Section label */}
            <div
              key={`label-${section.id}`}
              className="border-b border-r border-border bg-muted/30 p-2 last:border-b-0"
            >
              <p className="text-xs font-semibold text-megumi leading-tight">
                {section.name}
              </p>
              {section.time && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {section.time.slice(0, 5)}
                </p>
              )}
            </div>

            {/* Day cells */}
            {weekDays.map((day) => {
              const key = cellKey(day, section.id);
              const cellEntries = entryIndex.get(key) ?? [];
              return (
                <DroppableCell
                  key={key}
                  day={day}
                  sectionId={section.id}
                  isToday={day === today}
                >
                  <SortableContext
                    items={cellEntries.map((e) => e.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {cellEntries.map((entry) => (
                      <SortableEntryChip
                        key={entry.id}
                        entry={entry}
                        canMake={
                          entry.type === "recipe" && entry.recipe_id
                            ? fulfillmentByRecipeId[entry.recipe_id]
                            : undefined
                        }
                      />
                    ))}
                  </SortableContext>
                  {/* Add button — hover-reveal on the group/cell div */}
                  <button
                    onClick={() => onAddEntry(day, section.id)}
                    className="group/cell w-full flex items-center justify-center text-muted-foreground hover:text-soma rounded py-0.5 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
                    aria-label={`Add to ${section.name} on ${day}`}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </DroppableCell>
              );
            })}
          </React.Fragment>
        ))}

        {/* Unsectioned row — only if relevant entries exist */}
        {weekDays.some(
          (day) => (entryIndex.get(cellKey(day, null)) ?? []).length > 0
        ) && (
          <>
            <div className="border-r border-border bg-muted/30 p-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Other
              </p>
            </div>
            {weekDays.map((day) => {
              const key = cellKey(day, null);
              const cellEntries = entryIndex.get(key) ?? [];
              return (
                <DroppableCell
                  key={`none-${day}`}
                  day={day}
                  sectionId={null}
                  isToday={day === today}
                >
                  <SortableContext
                    items={cellEntries.map((e) => e.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {cellEntries.map((entry) => (
                      <SortableEntryChip
                        key={entry.id}
                        entry={entry}
                        canMake={
                          entry.type === "recipe" && entry.recipe_id
                            ? fulfillmentByRecipeId[entry.recipe_id]
                            : undefined
                        }
                      />
                    ))}
                  </SortableContext>
                  <button
                    onClick={() => onAddEntry(day, null)}
                    className="w-full flex items-center justify-center text-muted-foreground hover:text-soma rounded py-0.5 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
                    aria-label={`Add meal on ${day}`}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </DroppableCell>
              );
            })}
          </>
        )}
      </div>

      {/* Drag overlay — floating chip while dragging */}
      <DragOverlay>
        {activeEntry ? (
          <div className="shadow-xl rotate-1 opacity-95 cursor-grabbing">
            <MealPlanEntryCard
              entry={activeEntry}
              compact
              canMake={
                activeEntry.type === "recipe" && activeEntry.recipe_id
                  ? fulfillmentByRecipeId[activeEntry.recipe_id]
                  : undefined
              }
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
