import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getExpiryStatus,
  getExpiryLabel,
  getExpiryDaysLabel,
  getInventoryStats,
  computeConsumePlan,
  computeOpenPlan,
  type ConsumeInput,
  type OpenInput,
} from "../inventory-utils";

// Mock current date to 2025-02-01 for deterministic tests
const MOCK_TODAY = new Date("2025-02-01T00:00:00.000Z");

describe("inventory-utils", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getExpiryStatus", () => {
    it("returns 'none' when no date provided", () => {
      expect(getExpiryStatus(null)).toBe("none");
    });

    it("returns 'fresh' for date far in future", () => {
      expect(getExpiryStatus("2025-03-01")).toBe("fresh");
    });

    it("returns 'due_soon' within warning window (default 5 days)", () => {
      expect(getExpiryStatus("2025-02-04")).toBe("due_soon"); // 3 days away
      expect(getExpiryStatus("2025-02-06")).toBe("due_soon"); // 5 days away
    });

    it("returns 'fresh' just outside warning window", () => {
      expect(getExpiryStatus("2025-02-07")).toBe("fresh"); // 6 days away
    });

    it("returns 'overdue' for past date with due_type=1 (best before)", () => {
      expect(getExpiryStatus("2025-01-30", 1)).toBe("overdue");
    });

    it("returns 'expired' for past date with due_type=2 (expiration)", () => {
      expect(getExpiryStatus("2025-01-30", 2)).toBe("expired");
    });

    it("respects custom warningDays parameter", () => {
      expect(getExpiryStatus("2025-02-10", 1, 10)).toBe("due_soon"); // 9 days, within 10
      expect(getExpiryStatus("2025-02-10", 1, 5)).toBe("fresh"); // 9 days, outside 5
    });
  });

  describe("getExpiryLabel", () => {
    it("returns 'No expiry' when no date provided", () => {
      expect(getExpiryLabel(null)).toBe("No expiry");
    });

    it("returns 'Expired' prefix for expired items (due_type=2)", () => {
      expect(getExpiryLabel("2025-01-30", 2)).toMatch(/^Expired/);
    });

    it("returns 'Overdue' prefix for overdue items (due_type=1)", () => {
      expect(getExpiryLabel("2025-01-30", 1)).toMatch(/^Overdue/);
    });

    it("returns 'Due' prefix for due_soon items", () => {
      expect(getExpiryLabel("2025-02-03", 1)).toMatch(/^Due/);
    });

    it("returns just date for fresh items", () => {
      const label = getExpiryLabel("2025-03-15", 1);
      // Should not start with status prefix
      expect(label).not.toMatch(/^(Expired|Overdue|Due)/);
    });
  });

  describe("getExpiryDaysLabel", () => {
    it("returns empty string when no date provided", () => {
      expect(getExpiryDaysLabel(null)).toBe("");
    });

    it("returns 'Today' for today's date", () => {
      expect(getExpiryDaysLabel("2025-02-01")).toBe("Today");
    });

    it("returns '1d' for tomorrow", () => {
      expect(getExpiryDaysLabel("2025-02-02")).toBe("1d");
    });

    it("returns 'Xd' for future dates", () => {
      expect(getExpiryDaysLabel("2025-02-05")).toBe("4d");
    });

    it("returns '1d ago' for yesterday", () => {
      expect(getExpiryDaysLabel("2025-01-31")).toBe("1d ago");
    });

    it("returns 'Xd ago' for past dates", () => {
      expect(getExpiryDaysLabel("2025-01-28")).toBe("4d ago");
    });
  });

  describe("getInventoryStats", () => {
    // Helper to create mock stock entries
    const mockEntry = (overrides: {
      id?: string;
      product_id?: string;
      amount?: number;
      price?: number | null;
      best_before_date?: string | null;
      due_type?: number;
      min_stock_amount?: number;
      location_name?: string;
      product_group_name?: string;
    } = {}) => ({
      id: overrides.id ?? "entry-1",
      product_id: overrides.product_id ?? "prod-1",
      amount: overrides.amount ?? 1,
      price: overrides.price ?? null,
      best_before_date: overrides.best_before_date ?? null,
      location: { name: overrides.location_name ?? "Fridge" },
      product: {
        due_type: overrides.due_type ?? 1,
        min_stock_amount: overrides.min_stock_amount ?? 0,
        product_group: { name: overrides.product_group_name ?? "Dairy" },
      },
    });

    it("returns zero counts for empty array", () => {
      const stats = getInventoryStats([]);
      expect(stats.total).toBe(0);
      expect(stats.expired).toBe(0);
      expect(stats.totalValue).toBe(0);
    });

    it("counts total entries", () => {
      const entries = [
        mockEntry({ id: "1" }),
        mockEntry({ id: "2" }),
        mockEntry({ id: "3" }),
      ];
      const stats = getInventoryStats(entries as never[]);
      expect(stats.total).toBe(3);
    });

    it("counts entries by expiry status", () => {
      const entries = [
        mockEntry({ id: "1", best_before_date: "2025-01-20", due_type: 2 }), // expired
        mockEntry({ id: "2", best_before_date: "2025-01-25", due_type: 1 }), // overdue
        mockEntry({ id: "3", best_before_date: "2025-02-03" }), // due_soon
        mockEntry({ id: "4", best_before_date: "2025-03-01" }), // fresh
        mockEntry({ id: "5" }), // none
      ];
      const stats = getInventoryStats(entries as never[]);
      expect(stats.expired).toBe(1);
      expect(stats.overdue).toBe(1);
      expect(stats.due_soon).toBe(1);
      expect(stats.fresh).toBe(1);
      expect(stats.none).toBe(1);
    });

    it("calculates total value (price × amount)", () => {
      const entries = [
        mockEntry({ id: "1", price: 2.5, amount: 4 }), // 10
        mockEntry({ id: "2", price: 3.0, amount: 2 }), // 6
        mockEntry({ id: "3", price: null, amount: 5 }), // 0
      ];
      const stats = getInventoryStats(entries as never[]);
      expect(stats.totalValue).toBe(16);
    });

    it("groups entries by location", () => {
      const entries = [
        mockEntry({ id: "1", location_name: "Fridge" }),
        mockEntry({ id: "2", location_name: "Fridge" }),
        mockEntry({ id: "3", location_name: "Pantry" }),
      ];
      const stats = getInventoryStats(entries as never[]);
      expect(stats.byLocation["Fridge"]).toBe(2);
      expect(stats.byLocation["Pantry"]).toBe(1);
    });

    it("groups entries by product group", () => {
      const entries = [
        mockEntry({ id: "1", product_group_name: "Dairy" }),
        mockEntry({ id: "2", product_group_name: "Dairy" }),
        mockEntry({ id: "3", product_group_name: "Vegetables" }),
      ];
      const stats = getInventoryStats(entries as never[]);
      expect(stats.byProductGroup["Dairy"]).toBe(2);
      expect(stats.byProductGroup["Vegetables"]).toBe(1);
    });

    it("counts products below min stock", () => {
      const entries = [
        // Product A: total 3, min 5 → below
        mockEntry({ id: "1", product_id: "A", amount: 2, min_stock_amount: 5 }),
        mockEntry({ id: "2", product_id: "A", amount: 1, min_stock_amount: 5 }),
        // Product B: total 10, min 5 → ok
        mockEntry({ id: "3", product_id: "B", amount: 10, min_stock_amount: 5 }),
        // Product C: total 2, min 0 → no min set
        mockEntry({ id: "4", product_id: "C", amount: 2, min_stock_amount: 0 }),
      ];
      const stats = getInventoryStats(entries as never[]);
      expect(stats.belowMinStock).toBe(1);
    });

    it("handles entries with missing location (uses 'Unknown')", () => {
      const entries = [
        {
          ...mockEntry({ id: "1" }),
          location: null,
        },
      ];
      const stats = getInventoryStats(entries as never[]);
      expect(stats.byLocation["Unknown"]).toBe(1);
    });

    it("handles entries with missing product group (uses 'Uncategorized')", () => {
      const entries = [
        {
          ...mockEntry({ id: "1" }),
          product: {
            due_type: 1,
            min_stock_amount: 0,
            product_group: null,
          },
        },
      ];
      const stats = getInventoryStats(entries as never[]);
      expect(stats.byProductGroup["Uncategorized"]).toBe(1);
    });

    it("handles entries with missing product (defaults due_type to 1)", () => {
      const entries = [
        {
          id: "1",
          product_id: "prod-1",
          amount: 1,
          price: null,
          best_before_date: "2025-01-20", // past date
          location: { name: "Fridge" },
          product: null,
        },
      ];
      const stats = getInventoryStats(entries as never[]);
      // With due_type defaulting to 1, past date should be "overdue"
      expect(stats.overdue).toBe(1);
    });
  });

  // ============================================
  // computeConsumePlan
  // ============================================

  describe("computeConsumePlan", () => {
    const entry = (overrides: Partial<ConsumeInput> & { id: string }): ConsumeInput => ({
      amount: 1,
      open: false,
      best_before_date: null,
      purchased_date: null,
      ...overrides,
    });

    it("returns empty plan for zero amount", () => {
      const plan = computeConsumePlan([entry({ id: "a" })], 0);
      expect(plan.items).toHaveLength(0);
      expect(plan.totalConsumed).toBe(0);
    });

    it("returns empty plan for negative amount", () => {
      const plan = computeConsumePlan([entry({ id: "a" })], -1);
      expect(plan.items).toHaveLength(0);
    });

    it("returns empty plan for empty entries", () => {
      const plan = computeConsumePlan([], 5);
      expect(plan.items).toHaveLength(0);
      expect(plan.shortfall).toBe(5);
    });

    it("fully consumes a single entry (delete)", () => {
      const plan = computeConsumePlan([entry({ id: "a", amount: 3 })], 3);
      expect(plan.items).toHaveLength(1);
      expect(plan.items[0].entryId).toBe("a");
      expect(plan.items[0].deleteEntry).toBe(true);
      expect(plan.items[0].newAmount).toBe(0);
      expect(plan.items[0].amountToConsume).toBe(3);
      expect(plan.totalConsumed).toBe(3);
      expect(plan.shortfall).toBe(0);
    });

    it("partially consumes an entry (update)", () => {
      const plan = computeConsumePlan([entry({ id: "a", amount: 5 })], 2);
      expect(plan.items).toHaveLength(1);
      expect(plan.items[0].deleteEntry).toBe(false);
      expect(plan.items[0].newAmount).toBe(3);
      expect(plan.items[0].amountToConsume).toBe(2);
      expect(plan.totalConsumed).toBe(2);
    });

    it("reports shortfall when consuming more than available", () => {
      const plan = computeConsumePlan([entry({ id: "a", amount: 2 })], 5);
      expect(plan.totalConsumed).toBe(2);
      expect(plan.shortfall).toBe(3);
    });

    it("FIFO: opened entries first", () => {
      const entries = [
        entry({ id: "sealed", amount: 1, open: false, best_before_date: "2025-02-01" }),
        entry({ id: "opened", amount: 1, open: true, best_before_date: "2025-03-01" }),
      ];
      const plan = computeConsumePlan(entries, 1);
      expect(plan.items[0].entryId).toBe("opened");
    });

    it("FIFO: earliest best_before_date first (among same open status)", () => {
      const entries = [
        entry({ id: "later", amount: 1, best_before_date: "2025-03-01" }),
        entry({ id: "sooner", amount: 1, best_before_date: "2025-02-01" }),
      ];
      const plan = computeConsumePlan(entries, 1);
      expect(plan.items[0].entryId).toBe("sooner");
    });

    it("FIFO: null best_before_date sorted last", () => {
      const entries = [
        entry({ id: "no-date", amount: 1, best_before_date: null }),
        entry({ id: "has-date", amount: 1, best_before_date: "2025-06-01" }),
      ];
      const plan = computeConsumePlan(entries, 1);
      expect(plan.items[0].entryId).toBe("has-date");
    });

    it("FIFO: oldest purchased_date as tiebreaker", () => {
      const entries = [
        entry({ id: "newer", amount: 1, best_before_date: "2025-03-01", purchased_date: "2025-01-15" }),
        entry({ id: "older", amount: 1, best_before_date: "2025-03-01", purchased_date: "2025-01-01" }),
      ];
      const plan = computeConsumePlan(entries, 1);
      expect(plan.items[0].entryId).toBe("older");
    });

    it("FIFO: null purchased_date sorted last", () => {
      const entries = [
        entry({ id: "no-purchase", amount: 1, best_before_date: "2025-03-01", purchased_date: null }),
        entry({ id: "has-purchase", amount: 1, best_before_date: "2025-03-01", purchased_date: "2025-01-01" }),
      ];
      const plan = computeConsumePlan(entries, 1);
      expect(plan.items[0].entryId).toBe("has-purchase");
    });

    it("consumes across multiple entries in FIFO order", () => {
      const entries = [
        entry({ id: "a", amount: 2, open: true, best_before_date: "2025-02-01" }),
        entry({ id: "b", amount: 3, open: false, best_before_date: "2025-02-05" }),
        entry({ id: "c", amount: 4, open: false, best_before_date: "2025-03-01" }),
      ];
      const plan = computeConsumePlan(entries, 6);
      expect(plan.items).toHaveLength(3);
      expect(plan.items[0].entryId).toBe("a");
      expect(plan.items[0].deleteEntry).toBe(true); // fully consumed (2)
      expect(plan.items[1].entryId).toBe("b");
      expect(plan.items[1].deleteEntry).toBe(true); // fully consumed (3)
      expect(plan.items[2].entryId).toBe("c");
      expect(plan.items[2].amountToConsume).toBe(1); // partial (need 1 more)
      expect(plan.items[2].newAmount).toBe(3);
      expect(plan.totalConsumed).toBe(6);
      expect(plan.shortfall).toBe(0);
    });
  });

  // ============================================
  // computeOpenPlan
  // ============================================

  describe("computeOpenPlan", () => {
    const entry = (overrides: Partial<OpenInput> & { id: string }): OpenInput => ({
      open: false,
      best_before_date: null,
      purchased_date: null,
      ...overrides,
    });

    it("returns empty plan for zero count", () => {
      const plan = computeOpenPlan([entry({ id: "a" })], 0);
      expect(plan.items).toHaveLength(0);
      expect(plan.totalOpened).toBe(0);
    });

    it("returns empty plan for negative count", () => {
      const plan = computeOpenPlan([entry({ id: "a" })], -1);
      expect(plan.items).toHaveLength(0);
    });

    it("returns empty plan for empty entries", () => {
      const plan = computeOpenPlan([], 1);
      expect(plan.items).toHaveLength(0);
    });

    it("skips already-opened entries", () => {
      const entries = [
        entry({ id: "opened", open: true }),
        entry({ id: "sealed", open: false }),
      ];
      const plan = computeOpenPlan(entries, 2);
      expect(plan.items).toHaveLength(1);
      expect(plan.items[0].entryId).toBe("sealed");
      expect(plan.totalOpened).toBe(1);
    });

    it("returns empty plan when all entries already opened", () => {
      const entries = [
        entry({ id: "a", open: true }),
        entry({ id: "b", open: true }),
      ];
      const plan = computeOpenPlan(entries, 1);
      expect(plan.items).toHaveLength(0);
      expect(plan.totalOpened).toBe(0);
    });

    it("opens a single sealed entry", () => {
      const plan = computeOpenPlan([entry({ id: "a" })], 1);
      expect(plan.items).toHaveLength(1);
      expect(plan.items[0].entryId).toBe("a");
      expect(plan.totalOpened).toBe(1);
    });

    it("FIFO: earliest best_before_date first", () => {
      const entries = [
        entry({ id: "later", best_before_date: "2025-04-01" }),
        entry({ id: "sooner", best_before_date: "2025-02-01" }),
      ];
      const plan = computeOpenPlan(entries, 1);
      expect(plan.items[0].entryId).toBe("sooner");
    });

    it("FIFO: null best_before_date sorted last", () => {
      const entries = [
        entry({ id: "no-date", best_before_date: null }),
        entry({ id: "has-date", best_before_date: "2025-06-01" }),
      ];
      const plan = computeOpenPlan(entries, 1);
      expect(plan.items[0].entryId).toBe("has-date");
    });

    it("FIFO: oldest purchased_date as tiebreaker", () => {
      const entries = [
        entry({ id: "newer", best_before_date: "2025-03-01", purchased_date: "2025-01-20" }),
        entry({ id: "older", best_before_date: "2025-03-01", purchased_date: "2025-01-01" }),
      ];
      const plan = computeOpenPlan(entries, 1);
      expect(plan.items[0].entryId).toBe("older");
    });

    it("limits opened count to requested count", () => {
      const entries = [
        entry({ id: "a", best_before_date: "2025-02-01" }),
        entry({ id: "b", best_before_date: "2025-03-01" }),
        entry({ id: "c", best_before_date: "2025-04-01" }),
      ];
      const plan = computeOpenPlan(entries, 2);
      expect(plan.items).toHaveLength(2);
      expect(plan.items[0].entryId).toBe("a");
      expect(plan.items[1].entryId).toBe("b");
      expect(plan.totalOpened).toBe(2);
    });
  });
});