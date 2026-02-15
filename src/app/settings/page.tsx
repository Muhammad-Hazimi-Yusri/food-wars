import { createClient } from "@/lib/supabase/server";
import { GUEST_HOUSEHOLD_ID } from "@/lib/constants";
import { Noren } from "@/components/diner/Noren";
import { AiSettingsClient } from "@/components/settings/AiSettingsClient";
import { HouseholdAiSettings } from "@/types/database";

async function getSettingsData(): Promise<{
  aiSettings: HouseholdAiSettings | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { aiSettings: null };

  const householdId = user.is_anonymous
    ? GUEST_HOUSEHOLD_ID
    : (
        await supabase
          .from("households")
          .select("id")
          .eq("owner_id", user.id)
          .single()
      ).data?.id;

  if (!householdId) return { aiSettings: null };

  const { data } = await supabase
    .from("household_ai_settings")
    .select("*")
    .eq("household_id", householdId)
    .single();

  return { aiSettings: data };
}

export default async function SettingsPage() {
  const { aiSettings } = await getSettingsData();

  return (
    <div className="min-h-screen bg-hayama">
      <Noren />
      <main className="p-4 sm:p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-megumi mb-6">Settings</h1>
        <AiSettingsClient initialSettings={aiSettings} />
      </main>
    </div>
  );
}
