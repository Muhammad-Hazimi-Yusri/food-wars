"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MealPlanEntryCard } from "@/components/meal-plan/MealPlanEntryCard";
import { MealPlanWeekView } from "@/components/meal-plan/MealPlanWeekView";
import { AddMealEntryDialog } from "@/components/meal-plan/AddMealEntryDialog";
import type {
  MealPlanSection,
  MealPlanEntryWithRelations,
  Recipe,
  Product,
} from "@/types/database";

type Props = {
  weekStart: string; // YYYY-MM-DD (ISO Monday)
  weekDays: string[]; // 7 YYYY-MM-DD strings Mon→Sun
  today: string; // YYYY-MM-DD for highlighting
  sections: MealPlanSection[];
  entries: MealPlanEntryWithRelations[]; // All entries for the week
  recipes: Pick<Recipe, "id" | "name" | "base_servings" | "picture_file_name">[];
  products: Pick<Product, "id" | "name">[];
  fulfillmentByRecipeId: Record<string, boolean>;
};

// ---------------------------------------------------------------------------
// Date helpers — no date-fns, timezone-safe
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
  return `${DAY_LABELS_SHORT[d.getDay() === 0 ? 6 : d.getDay() - 1]} ${d.getDate()}`;
}

// ---------------------------------------------------------------------------
// Component
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
}: Props) {
  const router = useRouter();

  // Mobile: which day tab is selected (default to today if in week, else Mon)
  const [selectedDay, setSelectedDay] = useState<string>(() =>
    weekDays.includes(today) ? today : weekDays[0]
  );

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDay, setDialogDay] = useState<string>(today);
  const [dialogSectionId, setDialogSectionId] = useState<string | null>(null);

  const weekEnd = weekDays[6];
  const prevWeekStart = offsetDate(weekStart, -7);
  const nextWeekStart = offsetDate(weekStart, 7);

  const goToWeek = (monday: string) =>
    router.push(`/meal-plan?week=${monday}`);
  const goToToday = () => {
    // Derive this week's Monday from today
    const d = new Date(today + "T00:00:00");
    const dow = d.getDay(); // 0=Sun
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    const thisMonday = d.toISOString().split("T")[0];
    router.push(`/meal-plan?week=${thisMonday}`);
  };

  const openDialog = (day: string, sectionId: string | null) => {
    setDialogDay(day);
    setDialogSectionId(sectionId);
    setDialogOpen(true);
  };

  const handleSuccess = () => router.refresh();

  // Group entries for the selected day (mobile view)
  const dayEntries = useMemo(
    () => entries.filter((e) => e.day === selectedDay),
    [entries, selectedDay]
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

  // ── Week navigation header (shared across mobile + desktop) ──────────────
  const weekHeader = (
    <div className="flex items-center justify-between gap-3 mb-4">
      <Button
        variant="outline"
        size="icon"
        onClick={() => goToWeek(prevWeekStart)}
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex flex-col items-center gap-1">
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
        onClick={() => goToWeek(nextWeekStart)}
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );

  // ── Mobile day-tab view ───────────────────────────────────────────────────
  const mobileView = (
    <div className="md:hidden space-y-4">
      {weekHeader}

      {/* Day tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
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

      {/* Section cards for selected day */}
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
              <div className="p-2 space-y-1.5">
                {sectionEntries.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No meals planned
                  </p>
                ) : (
                  sectionEntries.map((entry) => (
                    <MealPlanEntryCard
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
              </div>
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
            <div className="p-2 space-y-1.5">
              {(entriesBySection.get(null) ?? []).map((entry) => (
                <MealPlanEntryCard
                  key={entry.id}
                  entry={entry}
                  canMake={
                    entry.type === "recipe" && entry.recipe_id
                      ? fulfillmentByRecipeId[entry.recipe_id]
                      : undefined
                  }
                />
              ))}
            </div>
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
    </div>
  );

  // ── Desktop week grid ─────────────────────────────────────────────────────
  const desktopView = (
    <div className="hidden md:block space-y-4">
      {weekHeader}
      <MealPlanWeekView
        weekDays={weekDays}
        sections={sections}
        entries={entries}
        fulfillmentByRecipeId={fulfillmentByRecipeId}
        today={today}
        onAddEntry={openDialog}
      />
    </div>
  );

  return (
    <>
      {mobileView}
      {desktopView}
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
    </>
  );
}
