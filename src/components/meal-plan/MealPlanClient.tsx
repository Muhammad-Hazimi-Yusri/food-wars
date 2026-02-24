"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Settings2, Copy, CopyCheck, ShoppingCart } from "lucide-react";
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MealPlanEntryCard } from "@/components/meal-plan/MealPlanEntryCard";
import { MealPlanWeekView } from "@/components/meal-plan/MealPlanWeekView";
import { AddMealEntryDialog } from "@/components/meal-plan/AddMealEntryDialog";
import { MealPlanSectionsManager } from "@/components/meal-plan/MealPlanSectionsManager";
import {
  reorderMealPlanEntries,
  updateMealPlanEntry,
  copyMealPlanDay,
  copyMealPlanWeek,
  generateWeekShoppingList,
} from "@/lib/meal-plan-actions";
import type {
  MealPlanSection,
  MealPlanEntryWithRelations,
  Recipe,
  Product,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  weekStart: string; // YYYY-MM-DD (ISO Monday)
  weekDays: string[]; // 7 YYYY-MM-DD strings Mon→Sun
  today: string; // YYYY-MM-DD
  sections: MealPlanSection[];
  entries: MealPlanEntryWithRelations[]; // server-fetched entries for the week
  recipes: Pick<Recipe, "id" | "name" | "base_servings" | "picture_file_name">[];
  products: Pick<Product, "id" | "name">[];
  fulfillmentByRecipeId: Record<string, boolean>;
  kcalPerServingByRecipe?: Record<string, number>; // kcal per 1 serving per recipe
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const DAY_LABELS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatWeekHeader(weekStart: string, weekEnd: string): string {
  const s = new Date(weekStart + "T00:00:00");
  const e = new Date(weekEnd + "T00:00:00");
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${MONTH_LABELS[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${s.getDate()} ${MONTH_LABELS[s.getMonth()]} – ${e.getDate()} ${MONTH_LABELS[e.getMonth()]} ${e.getFullYear()}`;
}

function formatDayTabLabel(dateStr: string, today: string): string {
  if (dateStr === today) return "Today";
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay();
  return `${DAY_LABELS_SHORT[dow === 0 ? 6 : dow - 1]} ${d.getDate()}`;
}

// ---------------------------------------------------------------------------
// Cell key helpers (must match MealPlanWeekView)
// ---------------------------------------------------------------------------

function parseCellDropId(droppableId: string): {
  day: string;
  sectionId: string | null;
} | null {
  if (!droppableId.startsWith("cell:")) return null;
  const rest = droppableId.slice(5); // drop "cell:"
  const pipe = rest.indexOf("|");
  if (pipe === -1) return null;
  const day = rest.slice(0, pipe);
  const sec = rest.slice(pipe + 1);
  return { day, sectionId: sec === "__none__" ? null : sec };
}

// ---------------------------------------------------------------------------
// Mobile inner helpers — DroppableSection + SortableDayEntryCard
// ---------------------------------------------------------------------------

function DroppableSection({
  day,
  sectionId,
  children,
}: {
  day: string;
  sectionId: string | null;
  children: React.ReactNode;
}) {
  const id = `cell:${day}|${sectionId ?? "__none__"}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={[
        "p-2 space-y-1.5 rounded-b-lg transition-colors",
        isOver ? "bg-soma/5 ring-2 ring-inset ring-soma/40" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

function SortableDayEntryCard({
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
      <MealPlanEntryCard entry={entry} canMake={canMake} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MealPlanClient({
  weekStart,
  weekDays,
  today,
  sections,
  entries,
  recipes,
  products,
  fulfillmentByRecipeId,
  kcalPerServingByRecipe,
}: Props) {
  const router = useRouter();

  // ── Entries state — optimistic DnD updates ───────────────────────────────
  const [localEntries, setLocalEntries] =
    useState<MealPlanEntryWithRelations[]>(entries);

  // Sync when server re-renders (e.g. after router.refresh())
  useEffect(() => {
    setLocalEntries(entries);
  }, [entries]);

  // ── Mobile: selected day + reset on week change ───────────────────────────
  const [selectedDay, setSelectedDay] = useState<string>(() =>
    weekDays.includes(today) ? today : weekDays[0]
  );
  useEffect(() => {
    setSelectedDay(weekDays.includes(today) ? today : weekDays[0]);
  }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDay, setDialogDay] = useState<string>(today);
  const [dialogSectionId, setDialogSectionId] = useState<string | null>(null);

  // ── Sections manager ──────────────────────────────────────────────────────
  const [sectionsManagerOpen, setSectionsManagerOpen] = useState(false);

  // ── Copy day dialog ───────────────────────────────────────────────────────
  const [copyDayOpen, setCopyDayOpen] = useState(false);
  const [copyDayFrom, setCopyDayFrom] = useState<string>(today);
  const [copyDayTo, setCopyDayTo] = useState<string>("");
  const [copyingDay, setCopyingDay] = useState(false);

  // ── Copy week ─────────────────────────────────────────────────────────────
  const [copyingWeek, setCopyingWeek] = useState(false);

  // ── Generate shopping list ────────────────────────────────────────────────
  const [generatingList, setGeneratingList] = useState(false);

  // ── Week navigation ───────────────────────────────────────────────────────
  const weekEnd = weekDays[6];
  const goToWeek = (monday: string) =>
    router.push(`/meal-plan?week=${monday}`);
  const goToToday = () => {
    const d = new Date(today + "T00:00:00");
    const dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    router.push(`/meal-plan?week=${d.toISOString().split("T")[0]}`);
  };

  const handleGenerateShoppingList = async () => {
    setGeneratingList(true);
    const result = await generateWeekShoppingList(weekStart);
    setGeneratingList(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to generate shopping list.");
    } else if (result.addedCount === 0) {
      toast(
        result.listName
          ? `All ingredients in stock — nothing to add to "${result.listName}".`
          : "No recipe meals this week, or all ingredients in stock."
      );
    } else {
      toast(
        `Added ${result.addedCount} ingredient${result.addedCount !== 1 ? "s" : ""} to "${result.listName}".`,
        {
          action: {
            label: "View list",
            onClick: () => router.push("/shopping-lists"),
          },
        }
      );
    }
  };

  const openDialog = (day: string, sectionId: string | null) => {
    setDialogDay(day);
    setDialogSectionId(sectionId);
    setDialogOpen(true);
  };

  const openCopyDay = (fromDay: string) => {
    setCopyDayFrom(fromDay);
    setCopyDayTo("");
    setCopyDayOpen(true);
  };

  const handleCopyDay = async () => {
    if (!copyDayTo) return;
    setCopyingDay(true);
    const result = await copyMealPlanDay(copyDayFrom, copyDayTo);
    setCopyingDay(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to copy day.");
    } else if (result.copiedCount === 0) {
      toast("No meals to copy on that day.");
    } else {
      toast(`Copied ${result.copiedCount} meal${result.copiedCount !== 1 ? "s" : ""} to ${copyDayTo}.`);
      setCopyDayOpen(false);
      router.refresh();
    }
  };

  const handleCopyWeekToNext = async () => {
    const nextWeek = offsetDate(weekStart, 7);
    setCopyingWeek(true);
    const result = await copyMealPlanWeek(weekStart, nextWeek);
    setCopyingWeek(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to copy week.");
    } else if (result.copiedCount === 0) {
      toast("No meals to copy this week.");
    } else {
      toast(
        `Copied ${result.copiedCount} meal${result.copiedCount !== 1 ? "s" : ""} to next week.`,
        {
          action: {
            label: "View",
            onClick: () => goToWeek(nextWeek),
          },
        }
      );
      router.refresh();
    }
  };

  const handleSuccess = () => router.refresh();

  // ── Derived state for mobile day view ─────────────────────────────────────
  const dayEntries = useMemo(
    () => localEntries.filter((e) => e.day === selectedDay),
    [localEntries, selectedDay]
  );

  const entriesBySection = useMemo(() => {
    const map = new Map<string | null, MealPlanEntryWithRelations[]>();
    for (const entry of dayEntries) {
      const key = entry.section_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    for (const [, group] of map) {
      group.sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [dayEntries]);

  const hasUnsectioned =
    entriesBySection.has(null) &&
    (entriesBySection.get(null)?.length ?? 0) > 0;

  // ── Calorie totals per day ─────────────────────────────────────────────────
  const kcalByDay = useMemo(() => {
    if (!kcalPerServingByRecipe) return {} as Record<string, number>;
    const result: Record<string, number> = {};
    for (const day of weekDays) {
      const dayTotal = localEntries
        .filter((e) => e.day === day && e.type === "recipe" && e.recipe_id)
        .reduce((sum, e) => {
          const perServing = kcalPerServingByRecipe[e.recipe_id!] ?? 0;
          const servings = e.recipe_servings ?? (e.recipe?.base_servings ?? 1);
          return sum + perServing * servings;
        }, 0);
      if (dayTotal > 0) result[day] = Math.round(dayTotal);
    }
    return result;
  }, [localEntries, kcalPerServingByRecipe, weekDays]);

  // ── DnD sensors (used by both mobile + desktop views) ────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Active drag entry (for DragOverlay in mobile view) ───────────────────
  const [activeMobileEntryId, setActiveMobileEntryId] = useState<string | null>(
    null
  );
  const activeMobileEntry =
    localEntries.find((e) => e.id === activeMobileEntryId) ?? null;

  const handleMobileDragStart = (event: DragStartEvent) => {
    setActiveMobileEntryId(event.active.id as string);
  };

  // ── Shared drag-end handler ───────────────────────────────────────────────
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeEntry = localEntries.find((e) => e.id === activeId);
      if (!activeEntry) return;

      // Determine target day + sectionId
      let targetDay: string;
      let targetSectionId: string | null;

      const cellMatch = parseCellDropId(overId);
      if (cellMatch) {
        targetDay = cellMatch.day;
        targetSectionId = cellMatch.sectionId;
      } else {
        const overEntry = localEntries.find((e) => e.id === overId);
        if (!overEntry) return;
        targetDay = overEntry.day;
        targetSectionId = overEntry.section_id;
      }

      const sourceDay = activeEntry.day;
      const sourceSectionId = activeEntry.section_id;
      const sameSlot =
        sourceDay === targetDay && sourceSectionId === targetSectionId;

      const snapshot = localEntries; // for revert

      if (sameSlot) {
        // ── Reorder within slot ─────────────────────────────────────────────
        const slotEntries = localEntries
          .filter(
            (e) => e.day === sourceDay && e.section_id === sourceSectionId
          )
          .sort((a, b) => a.sort_order - b.sort_order);

        const oldIndex = slotEntries.findIndex((e) => e.id === activeId);
        const newIndex = cellMatch
          ? slotEntries.length - 1
          : slotEntries.findIndex((e) => e.id === overId);

        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

        const reordered = arrayMove(slotEntries, oldIndex, newIndex);

        setLocalEntries((prev) => {
          const others = prev.filter(
            (e) =>
              !(e.day === sourceDay && e.section_id === sourceSectionId)
          );
          return [
            ...others,
            ...reordered.map((e, i) => ({ ...e, sort_order: i })),
          ];
        });

        const result = await reorderMealPlanEntries(reordered.map((e) => e.id));
        if (!result.success) {
          setLocalEntries(snapshot);
          toast.error("Failed to reorder.");
        }
      } else {
        // ── Move to different slot ──────────────────────────────────────────
        const targetSlotCount = localEntries.filter(
          (e) => e.day === targetDay && e.section_id === targetSectionId
        ).length;

        setLocalEntries((prev) =>
          prev.map((e) =>
            e.id === activeId
              ? {
                  ...e,
                  day: targetDay,
                  section_id: targetSectionId,
                  sort_order: targetSlotCount,
                }
              : e
          )
        );

        const result = await updateMealPlanEntry(activeId, {
          day: targetDay,
          section_id: targetSectionId,
          sort_order: targetSlotCount,
        });
        if (!result.success) {
          setLocalEntries(snapshot);
          toast.error("Failed to move meal.");
        }
      }
    },
    [localEntries]
  );

  const handleMobileDragEnd = async (event: DragEndEvent) => {
    setActiveMobileEntryId(null);
    await handleDragEnd(event);
  };

  // ── Week navigation header (shared) ──────────────────────────────────────
  const weekHeader = (
    <div className="space-y-1 mb-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => goToWeek(offsetDate(weekStart, -7))}
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0 text-center">
          <span className="font-semibold text-megumi text-base leading-tight">
            {formatWeekHeader(weekStart, weekEnd)}
          </span>
          <button
            onClick={goToToday}
            className="text-xs text-muted-foreground hover:text-soma transition-colors"
          >
            Today
          </button>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => goToWeek(offsetDate(weekStart, 7))}
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setSectionsManagerOpen(true)}
          aria-label="Manage sections"
          title="Manage sections"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Secondary actions row */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleGenerateShoppingList}
          disabled={generatingList}
          className="text-xs text-muted-foreground hover:text-soma transition-colors flex items-center gap-1 disabled:opacity-50"
          title="Add missing ingredients for this week's recipes to shopping list"
        >
          <ShoppingCart className="h-3 w-3" />
          {generatingList ? "Adding…" : "Generate list"}
        </button>
        <button
          onClick={handleCopyWeekToNext}
          disabled={copyingWeek}
          className="text-xs text-muted-foreground hover:text-soma transition-colors flex items-center gap-1 disabled:opacity-50"
          title="Copy this week's meals to next week"
        >
          <CopyCheck className="h-3 w-3" />
          {copyingWeek ? "Copying…" : "Copy week →"}
        </button>
      </div>
    </div>
  );

  // ── Mobile view with DnD ──────────────────────────────────────────────────
  const mobileView = (
    <div className="md:hidden space-y-4">
      {weekHeader}

      {/* Day tabs + copy day button */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 overflow-x-auto pb-1 flex-1 min-w-0">
          {weekDays.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                day === selectedDay
                  ? "bg-soma text-white"
                  : day === today
                  ? "bg-soma/10 text-soma"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {formatDayTabLabel(day, today)}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => openCopyDay(selectedDay)}
          title="Copy this day's meals to another day"
          aria-label="Copy day"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Daily kcal estimate */}
      {kcalByDay[selectedDay] != null && (
        <p className="text-xs text-muted-foreground text-right -mt-1">
          ~{kcalByDay[selectedDay].toLocaleString()} kcal
        </p>
      )}

      {/* Sections with DnD */}
      <DndContext
        id="meal-plan-mobile-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleMobileDragStart}
        onDragEnd={handleMobileDragEnd}
      >
        <div className="space-y-3">
          {sections.map((section) => {
            const sectionEntries = entriesBySection.get(section.id) ?? [];
            return (
              <div
                key={section.id}
                className="rounded-lg border border-border bg-card"
              >
                <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-megumi">
                      {section.name}
                    </span>
                    {section.time && (
                      <span className="text-xs text-muted-foreground">
                        {section.time.slice(0, 5)}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-soma"
                    onClick={() => openDialog(selectedDay, section.id)}
                    aria-label={`Add meal to ${section.name}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <DroppableSection day={selectedDay} sectionId={section.id}>
                  <SortableContext
                    items={sectionEntries.map((e) => e.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {sectionEntries.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        No meals planned
                      </p>
                    ) : (
                      sectionEntries.map((entry) => (
                        <SortableDayEntryCard
                          key={entry.id}
                          entry={entry}
                          canMake={
                            entry.type === "recipe" && entry.recipe_id
                              ? fulfillmentByRecipeId[entry.recipe_id]
                              : undefined
                          }
                        />
                      ))
                    )}
                  </SortableContext>
                </DroppableSection>
              </div>
            );
          })}

          {hasUnsectioned && (
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <span className="font-medium text-sm text-muted-foreground">
                  Other
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-soma"
                  onClick={() => openDialog(selectedDay, null)}
                  aria-label="Add meal (no section)"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <DroppableSection day={selectedDay} sectionId={null}>
                <SortableContext
                  items={(entriesBySection.get(null) ?? []).map((e) => e.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {(entriesBySection.get(null) ?? []).map((entry) => (
                    <SortableDayEntryCard
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
              </DroppableSection>
            </div>
          )}

          {sections.length === 0 && !hasUnsectioned && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No meals planned for this day.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openDialog(selectedDay, null)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add meal
              </Button>
            </div>
          )}

          {sections.length > 0 && (
            <div className="flex justify-center pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  openDialog(selectedDay, sections[0]?.id ?? null)
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                Add meal
              </Button>
            </div>
          )}
        </div>

        {/* Mobile drag overlay */}
        <DragOverlay>
          {activeMobileEntry ? (
            <div className="shadow-xl rotate-1 opacity-95 cursor-grabbing">
              <MealPlanEntryCard
                entry={activeMobileEntry}
                canMake={
                  activeMobileEntry.type === "recipe" &&
                  activeMobileEntry.recipe_id
                    ? fulfillmentByRecipeId[activeMobileEntry.recipe_id]
                    : undefined
                }
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );

  // ── Desktop view (week grid with its own DndContext in MealPlanWeekView) ──
  const desktopView = (
    <div className="hidden md:block space-y-4">
      {weekHeader}
      <MealPlanWeekView
        weekDays={weekDays}
        sections={sections}
        entries={localEntries}
        fulfillmentByRecipeId={fulfillmentByRecipeId}
        today={today}
        onAddEntry={openDialog}
        onDragEnd={handleDragEnd}
        kcalByDay={kcalByDay}
      />
    </div>
  );

  return (
    <>
      {mobileView}
      {desktopView}

      {/* Add meal entry dialog */}
      <AddMealEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        day={dialogDay}
        defaultSectionId={dialogSectionId}
        sections={sections}
        recipes={recipes}
        products={products}
        onSuccess={handleSuccess}
      />

      {/* Sections manager dialog */}
      <MealPlanSectionsManager
        open={sectionsManagerOpen}
        onOpenChange={setSectionsManagerOpen}
        sections={sections}
      />

      {/* Copy day dialog */}
      <Dialog open={copyDayOpen} onOpenChange={setCopyDayOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Copy day to…</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Copying meals from <span className="font-medium text-foreground">{copyDayFrom}</span>
              </p>
              <input
                type="date"
                value={copyDayTo}
                min={copyDayFrom === today ? undefined : undefined}
                onChange={(e) => setCopyDayTo(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCopyDayOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCopyDay}
                disabled={copyingDay || !copyDayTo}
              >
                {copyingDay ? "Copying…" : "Copy"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
