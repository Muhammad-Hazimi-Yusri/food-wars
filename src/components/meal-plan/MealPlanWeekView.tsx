"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";
import { MealPlanEntryCard } from "@/components/meal-plan/MealPlanEntryCard";
import type { MealPlanSection, MealPlanEntryWithRelations } from "@/types/database";

type Props = {
  weekDays: string[]; // 7 YYYY-MM-DD strings, Mon → Sun
  sections: MealPlanSection[];
  entries: MealPlanEntryWithRelations[];
  fulfillmentByRecipeId: Record<string, boolean>;
  today: string; // YYYY-MM-DD for highlighting
  onAddEntry: (day: string, sectionId: string | null) => void;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MealPlanWeekView({
  weekDays,
  sections,
  entries,
  fulfillmentByRecipeId,
  today,
  onAddEntry,
}: Props) {
  // Index: "YYYY-MM-DD|section_id" → entries[]
  const entryIndex = useMemo(() => {
    const idx = new Map<string, MealPlanEntryWithRelations[]>();
    for (const entry of entries) {
      const key = `${entry.day}|${entry.section_id ?? "__none__"}`;
      if (!idx.has(key)) idx.set(key, []);
      idx.get(key)!.push(entry);
    }
    for (const [, group] of idx) {
      group.sort((a, b) => a.sort_order - b.sort_order);
    }
    return idx;
  }, [entries]);

  // Grid: 1 label column + 7 day columns
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `80px repeat(7, minmax(0, 1fr))`,
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden" style={gridStyle}>
      {/* ── Header row ─────────────────────────────────────────── */}
      {/* Corner */}
      <div className="border-b border-r border-border bg-muted/30 p-2" />
      {weekDays.map((day, i) => {
        const isToday = day === today;
        const dayNum = day.split("-")[2]; // DD
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
          </div>
        );
      })}

      {/* ── Section rows ───────────────────────────────────────── */}
      {sections.map((section) => (
        <>
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
            const key = `${day}|${section.id}`;
            const cellEntries = entryIndex.get(key) ?? [];
            return (
              <div
                key={key}
                className={`group/cell border-b border-r border-border p-1.5 min-h-[72px] last:border-r-0 space-y-1 ${
                  day === today ? "bg-soma/5" : ""
                }`}
              >
                {cellEntries.map((entry) => (
                  <MealPlanEntryCard
                    key={entry.id}
                    entry={entry}
                    compact
                    canMake={
                      entry.type === "recipe" && entry.recipe_id
                        ? fulfillmentByRecipeId[entry.recipe_id]
                        : undefined
                    }
                  />
                ))}
                {/* Add button — only visible on hover */}
                <button
                  onClick={() => onAddEntry(day, section.id)}
                  className="w-full flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity text-muted-foreground hover:text-soma rounded py-0.5"
                  aria-label={`Add meal: ${section.name} on ${day}`}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </>
      ))}

      {/* Unsectioned row — only if entries without a section exist */}
      {weekDays.some((day) => (entryIndex.get(`${day}|__none__`) ?? []).length > 0) && (
        <>
          <div className="border-r border-border bg-muted/30 p-2">
            <p className="text-xs font-semibold text-muted-foreground">Other</p>
          </div>
          {weekDays.map((day) => {
            const cellEntries = entryIndex.get(`${day}|__none__`) ?? [];
            return (
              <div
                key={`none-${day}`}
                className={`group/cell border-r border-border p-1.5 min-h-[72px] last:border-r-0 space-y-1 ${
                  day === today ? "bg-soma/5" : ""
                }`}
              >
                {cellEntries.map((entry) => (
                  <MealPlanEntryCard
                    key={entry.id}
                    entry={entry}
                    compact
                    canMake={
                      entry.type === "recipe" && entry.recipe_id
                        ? fulfillmentByRecipeId[entry.recipe_id]
                        : undefined
                    }
                  />
                ))}
                <button
                  onClick={() => onAddEntry(day, null)}
                  className="w-full flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity text-muted-foreground hover:text-soma rounded py-0.5"
                  aria-label={`Add meal on ${day}`}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
