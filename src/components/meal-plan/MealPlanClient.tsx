"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MealPlanEntryCard } from "@/components/meal-plan/MealPlanEntryCard";
import { AddMealEntryDialog } from "@/components/meal-plan/AddMealEntryDialog";
import type {
  MealPlanSection,
  MealPlanEntryWithRelations,
  Recipe,
  Product,
} from "@/types/database";

type Props = {
  date: string; // YYYY-MM-DD
  sections: MealPlanSection[];
  entries: MealPlanEntryWithRelations[];
  recipes: Pick<Recipe, "id" | "name" | "base_servings" | "picture_file_name">[];
  products: Pick<Product, "id" | "name">[];
};

// ---------------------------------------------------------------------------
// Date helpers — no date-fns, timezone-safe
// ---------------------------------------------------------------------------

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDateDisplay(dateStr: string): string {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (dateStr === todayStr) return "Today";
  if (dateStr === tomorrowStr) return "Tomorrow";
  if (dateStr === yesterdayStr) return "Yesterday";

  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MealPlanClient({
  date,
  sections,
  entries,
  recipes,
  products,
}: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const prevDate = offsetDate(date, -1);
  const nextDate = offsetDate(date, 1);

  const navigate = (d: string) => router.push(`/meal-plan?date=${d}`);

  // Group entries by section_id for rendering
  const entriesBySection = useMemo(() => {
    const map = new Map<string | null, MealPlanEntryWithRelations[]>();
    for (const entry of entries) {
      const key = entry.section_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    // Sort within each group by sort_order
    for (const [, group] of map) {
      group.sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [entries]);

  const openDialog = (sectionId: string | null) => {
    setActiveSectionId(sectionId);
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    router.refresh();
  };

  // Sections to render: configured sections, plus a catch-all "Unsectioned" if entries exist without a section
  const hasUnsectioned = entriesBySection.has(null) && (entriesBySection.get(null)?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Date navigation header */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(prevDate)}
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex flex-col items-center gap-1">
          <span className="font-semibold text-megumi text-lg leading-tight">
            {formatDateDisplay(date)}
          </span>
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(nextDate)}
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Section columns */}
      <div className="space-y-4">
        {sections.map((section) => {
          const sectionEntries = entriesBySection.get(section.id) ?? [];
          return (
            <div key={section.id} className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-megumi">{section.name}</span>
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
                  onClick={() => openDialog(section.id)}
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
                    <MealPlanEntryCard key={entry.id} entry={entry} />
                  ))
                )}
              </div>
            </div>
          );
        })}

        {/* Unsectioned entries (entries without a section) */}
        {hasUnsectioned && (
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <span className="font-medium text-sm text-muted-foreground">Other</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-soma"
                onClick={() => openDialog(null)}
                aria-label="Add meal (no section)"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-2 space-y-1.5">
              {(entriesBySection.get(null) ?? []).map((entry) => (
                <MealPlanEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state — no sections at all */}
        {sections.length === 0 && !hasUnsectioned && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No meals planned for this day.</p>
            <Button variant="outline" size="sm" onClick={() => openDialog(null)}>
              <Plus className="h-4 w-4 mr-1" />
              Add meal
            </Button>
          </div>
        )}
      </div>

      {/* Add entry floating button (bottom-right, shown when sections exist) */}
      {sections.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openDialog(sections[0]?.id ?? null)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add meal
          </Button>
        </div>
      )}

      <AddMealEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        day={date}
        defaultSectionId={activeSectionId}
        sections={sections}
        recipes={recipes}
        products={products}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
