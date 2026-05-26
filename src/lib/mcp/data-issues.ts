import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = SupabaseClient<any, any, any>;

export type IssueType =
  | "stock_no_product"
  | "expired_past_grace"
  | "duplicate_product_name"
  | "product_no_stock_unit"
  | "negative_amount";

export type SuggestedFix =
  | { kind: "delete"; entity_table: "stock_entries" | "products"; entity_id: string }
  | { kind: "set_field"; entity_table: "stock_entries" | "products"; entity_id: string; field: string; value: unknown };

export type DataIssue = {
  id: string;
  issue_type: IssueType;
  entity_table: string;
  entity_id: string;
  description: string;
  suggested_fix: SuggestedFix;
};

/**
 * Stable ID for an issue so a repair call can identify exactly which row +
 * fix it's acting on, even if the LLM re-runs detection between detect and
 * repair.
 */
function computeIssueId(issue: Omit<DataIssue, "id">): string {
  const key = `${issue.issue_type}:${issue.entity_table}:${issue.entity_id}:${JSON.stringify(issue.suggested_fix)}`;
  return createHash("sha1").update(key).digest("hex").slice(0, 12);
}

export async function detectIssues(supabase: Supa, householdId: string): Promise<DataIssue[]> {
  const issues: DataIssue[] = [];

  // 1. Stock entries pointing at products that no longer exist.
  //    Use a left join via product:products(id) — null product means orphan.
  {
    const { data } = await supabase
      .from("stock_entries")
      .select("id, product_id, product:products(id)")
      .eq("household_id", householdId);
    for (const row of (data ?? []) as Array<{ id: string; product_id: string | null; product: { id: string } | { id: string }[] | null }>) {
      const prod = Array.isArray(row.product) ? row.product[0] : row.product;
      if (!prod) {
        const base = {
          issue_type: "stock_no_product" as const,
          entity_table: "stock_entries",
          entity_id: row.id,
          description: `Stock entry ${row.id.slice(0, 8)}… references a product (${row.product_id}) that no longer exists`,
          suggested_fix: { kind: "delete" as const, entity_table: "stock_entries" as const, entity_id: row.id },
        };
        issues.push({ ...base, id: computeIssueId(base) });
      }
    }
  }

  // 2. Use-by stock more than 30 days past its date. Best-before (due_type=1)
  //    is a quality date, not a safety one, so those are intentionally NOT
  //    flagged — shelf-stable items legitimately outlive their best-before.
  {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    const { data } = await supabase
      .from("stock_entries")
      .select("id, best_before_date, amount, product:products(name, due_type)")
      .eq("household_id", householdId)
      .gt("amount", 0)
      .not("best_before_date", "is", null)
      .lt("best_before_date", cutoffStr);
    for (const row of (data ?? []) as Array<{ id: string; best_before_date: string; amount: number; product: { name: string; due_type: number } | { name: string; due_type: number }[] | null }>) {
      // Skip the never-expires sentinel
      if (row.best_before_date === "2999-12-31") continue;
      const prod = Array.isArray(row.product) ? row.product[0] : row.product;
      // Only use-by (due_type=2) items are flagged; best-before is quality-only.
      if ((prod?.due_type ?? 1) !== 2) continue;
      const base = {
        issue_type: "expired_past_grace" as const,
        entity_table: "stock_entries",
        entity_id: row.id,
        description: `${prod?.name ?? "Unknown"} expired on ${row.best_before_date} (>30 days ago), amount ${row.amount}`,
        suggested_fix: { kind: "delete" as const, entity_table: "stock_entries" as const, entity_id: row.id },
      };
      issues.push({ ...base, id: computeIssueId(base) });
    }
  }

  // 3. Duplicate product names within the household.
  {
    const { data } = await supabase
      .from("products")
      .select("id, name")
      .eq("household_id", householdId)
      .eq("active", true);
    const byName = new Map<string, { id: string; name: string }[]>();
    for (const p of (data ?? []) as Array<{ id: string; name: string }>) {
      const key = p.name.trim().toLowerCase();
      if (!key) continue;
      const arr = byName.get(key) ?? [];
      arr.push(p);
      byName.set(key, arr);
    }
    for (const [, group] of byName) {
      if (group.length < 2) continue;
      // Report each duplicate after the first
      for (let i = 1; i < group.length; i++) {
        const dup = group[i];
        const base = {
          issue_type: "duplicate_product_name" as const,
          entity_table: "products",
          entity_id: dup.id,
          description: `Product "${dup.name}" is a duplicate of ${group[0].id} (case-insensitive). Review before deleting; stock entries on this product would be orphaned.`,
          suggested_fix: { kind: "set_field" as const, entity_table: "products" as const, entity_id: dup.id, field: "active", value: false },
        };
        issues.push({ ...base, id: computeIssueId(base) });
      }
    }
  }

  // 4. Active products without a stock unit.
  {
    const { data } = await supabase
      .from("products")
      .select("id, name, qu_id_stock")
      .eq("household_id", householdId)
      .eq("active", true)
      .is("qu_id_stock", null);
    for (const p of (data ?? []) as Array<{ id: string; name: string }>) {
      const base = {
        issue_type: "product_no_stock_unit" as const,
        entity_table: "products",
        entity_id: p.id,
        description: `Product "${p.name}" has no stock unit set; stock operations will misbehave`,
        suggested_fix: { kind: "set_field" as const, entity_table: "products" as const, entity_id: p.id, field: "active", value: false },
      };
      issues.push({ ...base, id: computeIssueId(base) });
    }
  }

  // 5. Stock entries with amount <= 0 (shouldn't happen but legacy data may).
  {
    const { data } = await supabase
      .from("stock_entries")
      .select("id, amount")
      .eq("household_id", householdId)
      .lte("amount", 0);
    for (const row of (data ?? []) as Array<{ id: string; amount: number }>) {
      const base = {
        issue_type: "negative_amount" as const,
        entity_table: "stock_entries",
        entity_id: row.id,
        description: `Stock entry ${row.id.slice(0, 8)}… has non-positive amount ${row.amount}`,
        suggested_fix: { kind: "delete" as const, entity_table: "stock_entries" as const, entity_id: row.id },
      };
      issues.push({ ...base, id: computeIssueId(base) });
    }
  }

  return issues;
}

export type RepairResult =
  | { success: true; action: "fix" | "delete"; correlationId?: string }
  | { success: false; error: string };

/**
 * Apply a single suggested_fix. Requires `confirm: true` — without it the
 * caller is rejected. Destructive deletes on stock_entries write a
 * stock_log row with transaction_type='inventory-correction' so the
 * change is visible in the Journal.
 */
export async function repairIssue(
  supabase: Supa,
  householdId: string,
  issues: DataIssue[],
  issueId: string,
  action: "fix" | "delete",
  confirm: boolean,
): Promise<RepairResult> {
  if (!confirm) {
    return { success: false, error: "Refusing destructive action: pass confirm=true to proceed" };
  }

  const issue = issues.find((i) => i.id === issueId);
  if (!issue) {
    return { success: false, error: `Issue ${issueId} not found. Run find_data_issues again — it may have already been fixed.` };
  }

  const fix = issue.suggested_fix;

  try {
    if (action === "delete" || fix.kind === "delete") {
      if (fix.entity_table === "stock_entries") {
        // Fetch the entry first so we can write a stock_log audit row before deleting.
        const { data: entry } = await supabase
          .from("stock_entries")
          .select("*")
          .eq("id", fix.entity_id)
          .eq("household_id", householdId)
          .maybeSingle();

        if (!entry) {
          return { success: false, error: "Entry already deleted" };
        }

        const correlationId = randomUUID();
        const today = new Date().toISOString().split("T")[0];

        await supabase.from("stock_log").insert({
          household_id: householdId,
          product_id: entry.product_id,
          amount: entry.amount,
          transaction_type: "inventory-correction",
          best_before_date: entry.best_before_date ?? null,
          purchased_date: entry.purchased_date ?? null,
          used_date: today,
          opened_date: entry.opened_date ?? null,
          price: entry.price ?? null,
          location_id: entry.location_id ?? null,
          shopping_location_id: entry.shopping_location_id ?? null,
          spoiled: false,
          stock_id: entry.stock_id,
          stock_entry_id: null,
          correlation_id: correlationId,
          transaction_id: randomUUID(),
          undone: false,
          note: JSON.stringify({ direction: "decrease", source: "mcp_repair", issue_type: issue.issue_type }),
        });

        const { error } = await supabase
          .from("stock_entries")
          .delete()
          .eq("id", fix.entity_id)
          .eq("household_id", householdId);
        if (error) throw error;

        return { success: true, action: "delete", correlationId };
      }

      // Products: never hard-delete from MCP. Deactivate instead.
      const { error } = await supabase
        .from("products")
        .update({ active: false })
        .eq("id", fix.entity_id)
        .eq("household_id", householdId);
      if (error) throw error;
      return { success: true, action: "delete" };
    }

    // Fix mode: apply the set_field directive.
    if (fix.kind === "set_field") {
      const { error } = await supabase
        .from(fix.entity_table)
        .update({ [fix.field]: fix.value })
        .eq("id", fix.entity_id)
        .eq("household_id", householdId);
      if (error) throw error;
      return { success: true, action: "fix" };
    }

    return { success: false, error: "Suggested fix has no fix action; pass action='delete' to remove instead" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "repair failed" };
  }
}
