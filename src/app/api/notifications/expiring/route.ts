import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentHouseholdId } from "@/lib/inventory-export-core";
import { getExpiryStatus } from "@/lib/inventory-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExpiringItem = {
  id: string;
  name: string;
  best_before_date: string;
  daysUntil: number;
};

type ExpiringPayload = {
  enabled: boolean;
  notifyBrowser: boolean;
  notifyDaysBefore: number;
  expired: ExpiringItem[];
  overdue: ExpiringItem[];
  dueSoon: ExpiringItem[];
  total: number;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const householdId = await resolveCurrentHouseholdId(supabase);
    if (!householdId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: settings } = await supabase
      .from("household_ai_settings")
      .select("notify_days_before, notify_browser, notify_bell")
      .eq("household_id", householdId)
      .maybeSingle();

    const notifyDaysBefore = settings?.notify_days_before ?? 3;
    const notifyBrowser = settings?.notify_browser ?? true;
    const notifyBell = settings?.notify_bell ?? true;

    if (!notifyBell) {
      const payload: ExpiringPayload = {
        enabled: false,
        notifyBrowser,
        notifyDaysBefore,
        expired: [],
        overdue: [],
        dueSoon: [],
        total: 0,
      };
      return NextResponse.json(payload);
    }

    const { data: entries, error } = await supabase
      .from("stock_entries")
      .select(
        `id, best_before_date, product:products(name, due_type)`
      )
      .eq("household_id", householdId)
      .gt("amount", 0)
      .not("best_before_date", "is", null)
      .order("best_before_date", { ascending: true });

    if (error) {
      console.error("[api/notifications/expiring] db error:", error);
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expired: ExpiringItem[] = [];
    const overdue: ExpiringItem[] = [];
    const dueSoon: ExpiringItem[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const e of (entries ?? []) as any[]) {
      const product = Array.isArray(e.product) ? e.product[0] : e.product;
      const name: string = product?.name ?? "Unknown";
      const dueType: number = product?.due_type ?? 1;
      const bbd: string | null = e.best_before_date;
      if (!bbd) continue;

      // Skip the sentinel "no-expiry" date used by the existing expiring report
      if (bbd === "2999-12-31") continue;

      const status = getExpiryStatus(bbd, dueType, notifyDaysBefore);
      if (status === "fresh" || status === "none") continue;

      const expiryDate = new Date(bbd);
      expiryDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / 86400000
      );

      const item: ExpiringItem = {
        id: e.id,
        name,
        best_before_date: bbd,
        daysUntil,
      };

      if (status === "expired") expired.push(item);
      else if (status === "overdue") overdue.push(item);
      else if (status === "due_soon") dueSoon.push(item);
    }

    const payload: ExpiringPayload = {
      enabled: true,
      notifyBrowser,
      notifyDaysBefore,
      expired,
      overdue,
      dueSoon,
      total: expired.length + overdue.length + dueSoon.length,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("GET /api/notifications/expiring error:", error);
    return NextResponse.json(
      { error: "Failed to fetch expiring items" },
      { status: 500 }
    );
  }
}
