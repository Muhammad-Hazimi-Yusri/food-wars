import { describe, it, expect } from "vitest";
import { generateQuickCombos, type ComboProduct } from "../cook-now-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function product(
  overrides: Partial<ComboProduct> & { name: string; cooking_role: string }
): ComboProduct {
  return {
    id: overrides.name.toLowerCase().replace(/\s+/g, "-"),
    earliest_expiry: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateQuickCombos", () => {
  it("returns 3 combos when enough products exist, sorted by expiry", () => {
    const products: ComboProduct[] = [
      product({ name: "Chicken", cooking_role: "protein", earliest_expiry: "2026-04-01" }),
      product({ name: "Beef", cooking_role: "protein", earliest_expiry: "2026-03-28" }),
      product({ name: "Salmon", cooking_role: "protein", earliest_expiry: "2026-03-30" }),
      product({ name: "Gochujang", cooking_role: "seasoning_system", earliest_expiry: "2026-12-01" }),
      product({ name: "Soy Sauce", cooking_role: "seasoning_system", earliest_expiry: "2026-06-01" }),
      product({ name: "Miso", cooking_role: "seasoning_system", earliest_expiry: "2026-09-01" }),
      product({ name: "Rice", cooking_role: "form_factor_base", earliest_expiry: null }),
      product({ name: "Noodles", cooking_role: "form_factor_base", earliest_expiry: "2026-08-01" }),
    ];

    const combos = generateQuickCombos(products);

    expect(combos).toHaveLength(3);
    // Proteins sorted by expiry: Beef (03-28), Salmon (03-30), Chicken (04-01)
    expect(combos[0].protein.name).toBe("Beef");
    expect(combos[1].protein.name).toBe("Salmon");
    expect(combos[2].protein.name).toBe("Chicken");
    // Seasonings sorted by expiry: Soy Sauce (06-01), Miso (09-01), Gochujang (12-01)
    expect(combos[0].seasoning.name).toBe("Soy Sauce");
    expect(combos[1].seasoning.name).toBe("Miso");
    expect(combos[2].seasoning.name).toBe("Gochujang");
    // Bases sorted: Noodles (08-01) then Rice (null → last)
    expect(combos[0].base?.name).toBe("Noodles");
    expect(combos[1].base?.name).toBe("Rice");
    expect(combos[2].base).toBeUndefined();
  });

  it("returns fewer combos when products are limited", () => {
    const products: ComboProduct[] = [
      product({ name: "Tofu", cooking_role: "protein", earliest_expiry: "2026-04-01" }),
      product({ name: "Cumin", cooking_role: "seasoning_system", earliest_expiry: "2026-12-01" }),
    ];

    const combos = generateQuickCombos(products);

    expect(combos).toHaveLength(1);
    expect(combos[0].protein.name).toBe("Tofu");
    expect(combos[0].seasoning.name).toBe("Cumin");
    expect(combos[0].base).toBeUndefined();
  });

  it("returns empty array when no protein/produce products", () => {
    const products: ComboProduct[] = [
      product({ name: "Paprika", cooking_role: "seasoning_system" }),
      product({ name: "Rice", cooking_role: "form_factor_base" }),
    ];

    expect(generateQuickCombos(products)).toEqual([]);
  });

  it("returns empty array when no seasoning products", () => {
    const products: ComboProduct[] = [
      product({ name: "Chicken", cooking_role: "protein" }),
      product({ name: "Rice", cooking_role: "form_factor_base" }),
    ];

    expect(generateQuickCombos(products)).toEqual([]);
  });

  it("includes form_factor_base when available, omits when not", () => {
    const products: ComboProduct[] = [
      product({ name: "Chicken", cooking_role: "protein" }),
      product({ name: "Pork", cooking_role: "protein" }),
      product({ name: "Salt", cooking_role: "seasoning_system" }),
      product({ name: "Pepper", cooking_role: "seasoning_system" }),
      product({ name: "Rice", cooking_role: "form_factor_base" }),
    ];

    const combos = generateQuickCombos(products);

    expect(combos).toHaveLength(2);
    expect(combos[0].base?.name).toBe("Rice");
    expect(combos[1].base).toBeUndefined();
  });

  it("each product appears in at most one combo", () => {
    const products: ComboProduct[] = [
      product({ name: "Chicken", cooking_role: "protein" }),
      product({ name: "Beef", cooking_role: "protein" }),
      product({ name: "Salt", cooking_role: "seasoning_system" }),
      product({ name: "Pepper", cooking_role: "seasoning_system" }),
      product({ name: "Rice", cooking_role: "form_factor_base" }),
    ];

    const combos = generateQuickCombos(products);
    const allIds = combos.flatMap((c) => [
      c.protein.id,
      c.seasoning.id,
      ...(c.base ? [c.base.id] : []),
    ]);

    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("null expiry dates sort last", () => {
    const products: ComboProduct[] = [
      product({ name: "Chicken", cooking_role: "protein", earliest_expiry: null }),
      product({ name: "Beef", cooking_role: "protein", earliest_expiry: "2026-03-28" }),
      product({ name: "Salt", cooking_role: "seasoning_system", earliest_expiry: null }),
      product({ name: "Pepper", cooking_role: "seasoning_system", earliest_expiry: "2026-06-01" }),
    ];

    const combos = generateQuickCombos(products);

    expect(combos).toHaveLength(2);
    expect(combos[0].protein.name).toBe("Beef");
    expect(combos[0].seasoning.name).toBe("Pepper");
    expect(combos[1].protein.name).toBe("Chicken");
    expect(combos[1].seasoning.name).toBe("Salt");
  });

  it("accepts legacy 'vegetable' role as protein/produce bucket", () => {
    const products: ComboProduct[] = [
      product({ name: "Carrots", cooking_role: "vegetable", earliest_expiry: "2026-04-01" }),
      product({ name: "Soy Sauce", cooking_role: "seasoning_system", earliest_expiry: "2026-12-01" }),
    ];

    const combos = generateQuickCombos(products);

    expect(combos).toHaveLength(1);
    expect(combos[0].protein.name).toBe("Carrots");
    expect(combos[0].seasoning.name).toBe("Soy Sauce");
  });

  it("treats 'produce' role as protein/produce bucket", () => {
    const products: ComboProduct[] = [
      product({ name: "Spinach", cooking_role: "produce", earliest_expiry: "2026-04-01" }),
      product({ name: "Garlic Powder", cooking_role: "seasoning_system", earliest_expiry: "2026-12-01" }),
      product({ name: "Pasta", cooking_role: "form_factor_base", earliest_expiry: null }),
    ];

    const combos = generateQuickCombos(products);

    expect(combos).toHaveLength(1);
    expect(combos[0].protein.name).toBe("Spinach");
    expect(combos[0].base?.name).toBe("Pasta");
  });
});
