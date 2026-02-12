import { describe, it, expect } from "vitest";
import { parseDateShorthand } from "../date-shorthands";

// Fixed "today" for deterministic tests: 2026-02-12
const TODAY = new Date(2026, 1, 12); // Feb 12, 2026

describe("parseDateShorthand", () => {
  // === Never expires ===
  it('parses "x" as never expires', () => {
    expect(parseDateShorthand("x", TODAY)).toBe("2999-12-31");
  });

  it('parses "never" as never expires', () => {
    expect(parseDateShorthand("never", TODAY)).toBe("2999-12-31");
  });

  it('parses "X" (uppercase) as never expires', () => {
    expect(parseDateShorthand("X", TODAY)).toBe("2999-12-31");
  });

  it('parses "NEVER" (uppercase) as never expires', () => {
    expect(parseDateShorthand("NEVER", TODAY)).toBe("2999-12-31");
  });

  // === Days ===
  it('parses "+7" as today + 7 days', () => {
    expect(parseDateShorthand("+7", TODAY)).toBe("2026-02-19");
  });

  it('parses "+7d" as today + 7 days', () => {
    expect(parseDateShorthand("+7d", TODAY)).toBe("2026-02-19");
  });

  it('parses "+0" as today', () => {
    expect(parseDateShorthand("+0", TODAY)).toBe("2026-02-12");
  });

  it('parses "+30d" crossing month boundary', () => {
    expect(parseDateShorthand("+30d", TODAY)).toBe("2026-03-14");
  });

  it('parses "+365d" crossing year boundary', () => {
    expect(parseDateShorthand("+365", TODAY)).toBe("2027-02-12");
  });

  // === Months ===
  it('parses "+1m" as today + 1 month', () => {
    expect(parseDateShorthand("+1m", TODAY)).toBe("2026-03-12");
  });

  it('parses "+6m" as today + 6 months', () => {
    expect(parseDateShorthand("+6m", TODAY)).toBe("2026-08-12");
  });

  it('parses "+12m" crossing year boundary', () => {
    expect(parseDateShorthand("+12m", TODAY)).toBe("2027-02-12");
  });

  // === Years ===
  it('parses "+1y" as today + 1 year', () => {
    expect(parseDateShorthand("+1y", TODAY)).toBe("2027-02-12");
  });

  it('parses "+2y" as today + 2 years', () => {
    expect(parseDateShorthand("+2y", TODAY)).toBe("2028-02-12");
  });

  // === MMDD ===
  it('parses "0517" as May 17 current year (future date)', () => {
    expect(parseDateShorthand("0517", TODAY)).toBe("2026-05-17");
  });

  it('parses "1225" as Dec 25 current year (future date)', () => {
    expect(parseDateShorthand("1225", TODAY)).toBe("2026-12-25");
  });

  it('parses "0101" as Jan 1 next year (past date wraps)', () => {
    expect(parseDateShorthand("0101", TODAY)).toBe("2027-01-01");
  });

  it('parses "0212" as today (same day stays current year)', () => {
    expect(parseDateShorthand("0212", TODAY)).toBe("2026-02-12");
  });

  it('parses "0211" as Feb 11 next year (yesterday wraps)', () => {
    expect(parseDateShorthand("0211", TODAY)).toBe("2027-02-11");
  });

  // === Invalid inputs ===
  it("returns null for empty string", () => {
    expect(parseDateShorthand("", TODAY)).toBeNull();
  });

  it("returns null for whitespace only", () => {
    expect(parseDateShorthand("   ", TODAY)).toBeNull();
  });

  it("returns null for random text", () => {
    expect(parseDateShorthand("hello", TODAY)).toBeNull();
  });

  it("returns null for partial date", () => {
    expect(parseDateShorthand("051", TODAY)).toBeNull();
  });

  it("returns null for invalid month in MMDD", () => {
    expect(parseDateShorthand("1301", TODAY)).toBeNull();
  });

  it("returns null for invalid day in MMDD", () => {
    expect(parseDateShorthand("0132", TODAY)).toBeNull();
  });

  it("returns null for bare number that isn't 4 digits", () => {
    expect(parseDateShorthand("12345", TODAY)).toBeNull();
  });

  // === Whitespace handling ===
  it("trims whitespace before parsing", () => {
    expect(parseDateShorthand("  +7d  ", TODAY)).toBe("2026-02-19");
  });
});
