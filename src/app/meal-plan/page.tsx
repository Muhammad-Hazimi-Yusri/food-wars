import { createClient } from "@/lib/supabase/server";
import { Noren } from "@/components/diner/Noren";
import { CalendarDays } from "lucide-react";

export default async function MealPlanPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-hayama">
        <Noren />
        <main className="max-w-5xl mx-auto p-4 sm:p-6">
          <p className="text-muted-foreground">
            Please sign in to view your meal plan.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hayama">
      <Noren />
      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground/40" />
          <h2 className="text-xl font-semibold text-megumi">
            No meals planned yet
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Meal planning is coming in v0.12.1. You will be able to schedule
            recipes and products across the week.
          </p>
        </div>
      </main>
    </div>
  );
}
