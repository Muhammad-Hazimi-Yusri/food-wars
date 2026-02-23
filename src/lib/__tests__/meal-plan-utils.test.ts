import { describe, it, expect } from 'vitest';
import type { RecipeIngredientWithRelations } from '@/types/database';
import { aggregateWeekIngredients, computeDailyNutrition, type EntryForAggregation } from '../meal-plan-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIng(
  overrides: Partial<RecipeIngredientWithRelations> & {
    recipe_id: string;
    product_id: string | null;
  }
): RecipeIngredientWithRelations {
  const base: RecipeIngredientWithRelations = {
    id: 'ing-' + Math.random(),
    household_id: 'hh-1',
    recipe_id: 'r0',
    product_id: 'p0',
    amount: 1,
    qu_id: null,
    note: null,
    ingredient_group: null,
    variable_amount: null,
    only_check_single_unit_in_stock: false,
    not_check_stock_fulfillment: false,
    price_factor: 1,
    sort_order: 0,
    created_at: '2026-01-01',
    product: null,
    qu: null,
  } as RecipeIngredientWithRelations;
  return { ...base, ...overrides } as RecipeIngredientWithRelations;
}

function makeEntry(
  recipe_id: string,
  recipe_servings: number | null = null
): EntryForAggregation {
  return { type: 'recipe', recipe_id, recipe_servings };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('aggregateWeekIngredients', () => {
  it('returns empty array when no recipe entries', () => {
    const entries: EntryForAggregation[] = [
      { type: 'note', recipe_id: null, recipe_servings: null },
      { type: 'product', recipe_id: null, recipe_servings: null },
    ];
    const result = aggregateWeekIngredients(entries, new Map(), new Map(), new Map());
    expect(result).toEqual([]);
  });

  it('returns empty array when no ingredients found for recipe', () => {
    const entries = [makeEntry('r1', 2)];
    const result = aggregateWeekIngredients(
      entries,
      new Map(), // no ingredients
      new Map(),
      new Map([['r1', 1]])
    );
    expect(result).toEqual([]);
  });

  it('scales ingredient by recipe_servings / base_servings', () => {
    // base = 2, desired = 4 → scale = 2; amount = 3 → needed = 6
    const ings = new Map([['r1', [makeIng({ recipe_id: 'r1', product_id: 'p1', amount: 3 })]]]);
    const result = aggregateWeekIngredients(
      [makeEntry('r1', 4)],
      ings,
      new Map(), // no stock
      new Map([['r1', 2]])
    );
    expect(result).toHaveLength(1);
    expect(result[0].productId).toBe('p1');
    expect(result[0].amount).toBeCloseTo(6);
  });

  it('uses base_servings when recipe_servings is null', () => {
    // no desired → falls back to base; scale = 1
    const ings = new Map([['r1', [makeIng({ recipe_id: 'r1', product_id: 'p1', amount: 5 })]]]);
    const result = aggregateWeekIngredients(
      [makeEntry('r1', null)],
      ings,
      new Map(),
      new Map([['r1', 2]])
    );
    expect(result[0].amount).toBeCloseTo(5);
  });

  it('consolidates same product×qu across multiple entries', () => {
    // Two entries of r1, each needing 2 of p1 → total 4; no stock → missing 4
    const ings = new Map([['r1', [makeIng({ recipe_id: 'r1', product_id: 'p1', amount: 2 })]]]);
    const result = aggregateWeekIngredients(
      [makeEntry('r1', 1), makeEntry('r1', 1)],
      ings,
      new Map(),
      new Map([['r1', 1]])
    );
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBeCloseTo(4);
  });

  it('treats same product with different qu_ids as separate entries', () => {
    const ings = new Map([
      [
        'r1',
        [
          makeIng({ recipe_id: 'r1', product_id: 'p1', amount: 1, qu_id: 'qu-g' }),
          makeIng({ recipe_id: 'r1', product_id: 'p1', amount: 1, qu_id: 'qu-kg' }),
        ],
      ],
    ]);
    const result = aggregateWeekIngredients(
      [makeEntry('r1', 1)],
      ings,
      new Map(),
      new Map([['r1', 1]])
    );
    expect(result).toHaveLength(2);
  });

  it('subtracts current stock from total needed', () => {
    // need 5, have 3 → missing 2
    const ings = new Map([['r1', [makeIng({ recipe_id: 'r1', product_id: 'p1', amount: 5 })]]]);
    const result = aggregateWeekIngredients(
      [makeEntry('r1', 1)],
      ings,
      new Map([['p1', 3]]),
      new Map([['r1', 1]])
    );
    expect(result[0].amount).toBeCloseTo(2);
  });

  it('omits products that are fully in stock', () => {
    // need 3, have 5 → no deficit
    const ings = new Map([['r1', [makeIng({ recipe_id: 'r1', product_id: 'p1', amount: 3 })]]]);
    const result = aggregateWeekIngredients(
      [makeEntry('r1', 1)],
      ings,
      new Map([['p1', 5]]),
      new Map([['r1', 1]])
    );
    expect(result).toHaveLength(0);
  });

  it('skips not_check_stock_fulfillment ingredients', () => {
    const ings = new Map([
      [
        'r1',
        [makeIng({ recipe_id: 'r1', product_id: 'p1', amount: 5, not_check_stock_fulfillment: true })],
      ],
    ]);
    const result = aggregateWeekIngredients(
      [makeEntry('r1', 1)],
      ings,
      new Map(),
      new Map([['r1', 1]])
    );
    expect(result).toHaveLength(0);
  });

  it('skips variable_amount ingredients', () => {
    const ings = new Map([
      [
        'r1',
        [makeIng({ recipe_id: 'r1', product_id: 'p1', amount: 1, variable_amount: 'to taste' })],
      ],
    ]);
    const result = aggregateWeekIngredients(
      [makeEntry('r1', 1)],
      ings,
      new Map(),
      new Map([['r1', 1]])
    );
    expect(result).toHaveLength(0);
  });

  it('skips ingredients with no product_id', () => {
    const ings = new Map([
      ['r1', [makeIng({ recipe_id: 'r1', product_id: null as unknown as string, amount: 3 })]],
    ]);
    const result = aggregateWeekIngredients(
      [makeEntry('r1', 1)],
      ings,
      new Map(),
      new Map([['r1', 1]])
    );
    expect(result).toHaveLength(0);
  });

  it('skips ingredients whose product has not_check_stock_fulfillment_for_recipes', () => {
    const ings = new Map([
      [
        'r1',
        [
          makeIng({
            recipe_id: 'r1',
            product_id: 'p1',
            amount: 3,
            product: {
              id: 'p1',
              name: 'Salt',
              qu_id_stock: null,
              not_check_stock_fulfillment_for_recipes: true,
            },
          }),
        ],
      ],
    ]);
    const result = aggregateWeekIngredients(
      [makeEntry('r1', 1)],
      ings,
      new Map(),
      new Map([['r1', 1]])
    );
    expect(result).toHaveLength(0);
  });

  it('aggregates across multiple recipes in the same week', () => {
    // r1 needs 2 of p1; r2 needs 3 of p1 → total 5, stock 1 → missing 4
    const ings = new Map([
      ['r1', [makeIng({ recipe_id: 'r1', product_id: 'p1', amount: 2, qu_id: 'qu1' })]],
      ['r2', [makeIng({ recipe_id: 'r2', product_id: 'p1', amount: 3, qu_id: 'qu1' })]],
    ]);
    const result = aggregateWeekIngredients(
      [makeEntry('r1', 1), makeEntry('r2', 1)],
      ings,
      new Map([['p1', 1]]),
      new Map([['r1', 1], ['r2', 1]])
    );
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBeCloseTo(4);
  });
});

// ---------------------------------------------------------------------------
// computeDailyNutrition tests
// ---------------------------------------------------------------------------

describe('computeDailyNutrition', () => {
  it('returns 0 for empty entries', () => {
    expect(computeDailyNutrition([], new Map())).toBe(0);
  });

  it('returns 0 for non-recipe entries', () => {
    const entries: EntryForAggregation[] = [
      { type: 'note', recipe_id: null, recipe_servings: null },
      { type: 'product', recipe_id: null, recipe_servings: null },
    ];
    expect(computeDailyNutrition(entries, new Map([['r1', 500]]))).toBe(0);
  });

  it('returns 0 when recipe has no nutrition data', () => {
    const entries: EntryForAggregation[] = [
      { type: 'recipe', recipe_id: 'r1', recipe_servings: 2 },
    ];
    expect(computeDailyNutrition(entries, new Map())).toBe(0);
  });

  it('returns kcal for a single recipe entry at 1 serving', () => {
    // 400 kcal/serving × 1 serving = 400
    const entries: EntryForAggregation[] = [
      { type: 'recipe', recipe_id: 'r1', recipe_servings: 1 },
    ];
    expect(computeDailyNutrition(entries, new Map([['r1', 400]]))).toBe(400);
  });

  it('scales kcal by recipe_servings', () => {
    // 300 kcal/serving × 3 servings = 900
    const entries: EntryForAggregation[] = [
      { type: 'recipe', recipe_id: 'r1', recipe_servings: 3 },
    ];
    expect(computeDailyNutrition(entries, new Map([['r1', 300]]))).toBe(900);
  });

  it('falls back to 1 serving when recipe_servings is null', () => {
    const entries: EntryForAggregation[] = [
      { type: 'recipe', recipe_id: 'r1', recipe_servings: null },
    ];
    expect(computeDailyNutrition(entries, new Map([['r1', 250]]))).toBe(250);
  });

  it('sums kcal across multiple entries', () => {
    // r1: 400 × 2 = 800; r2: 200 × 1 = 200 → total 1000
    const entries: EntryForAggregation[] = [
      { type: 'recipe', recipe_id: 'r1', recipe_servings: 2 },
      { type: 'recipe', recipe_id: 'r2', recipe_servings: 1 },
    ];
    const map = new Map([['r1', 400], ['r2', 200]]);
    expect(computeDailyNutrition(entries, map)).toBe(1000);
  });
});
