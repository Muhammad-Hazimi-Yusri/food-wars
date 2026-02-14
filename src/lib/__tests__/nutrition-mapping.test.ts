import { describe, it, expect } from "vitest";
import { mapOFFNutrimentsToNutrition, type OFFNutriments } from "../openfoodfacts";

describe("mapOFFNutrimentsToNutrition", () => {
  it("maps complete nutriments data", () => {
    const nutriments: OFFNutriments = {
      energy_kj_100g: 340,
      energy_kcal_100g: 81,
      fat_100g: 0.2,
      saturated_fat_100g: 0.1,
      carbohydrates_100g: 12.9,
      sugars_100g: 5.9,
      fiber_100g: 3.7,
      proteins_100g: 4.7,
      salt_100g: 1.1,
    };

    const result = mapOFFNutrimentsToNutrition(nutriments, "a");

    expect(result).toEqual({
      energy_kj: 340,
      energy_kcal: 81,
      fat: 0.2,
      saturated_fat: 0.1,
      carbohydrates: 12.9,
      sugars: 5.9,
      fibre: 3.7,
      protein: 4.7,
      salt: 1.1,
      nutrition_grade: "a",
      data_source: "off",
    });
  });

  it("preserves null fields for partial data", () => {
    const nutriments: OFFNutriments = {
      energy_kj_100g: null,
      energy_kcal_100g: 200,
      fat_100g: 5.0,
      saturated_fat_100g: null,
      carbohydrates_100g: null,
      sugars_100g: null,
      fiber_100g: null,
      proteins_100g: null,
      salt_100g: null,
    };

    const result = mapOFFNutrimentsToNutrition(nutriments, null);

    expect(result.energy_kj).toBeNull();
    expect(result.energy_kcal).toBe(200);
    expect(result.fat).toBe(5.0);
    expect(result.saturated_fat).toBeNull();
    expect(result.nutrition_grade).toBeNull();
    expect(result.data_source).toBe("off");
  });

  it("handles all null nutriments", () => {
    const nutriments: OFFNutriments = {
      energy_kj_100g: null,
      energy_kcal_100g: null,
      fat_100g: null,
      saturated_fat_100g: null,
      carbohydrates_100g: null,
      sugars_100g: null,
      fiber_100g: null,
      proteins_100g: null,
      salt_100g: null,
    };

    const result = mapOFFNutrimentsToNutrition(nutriments, null);

    expect(result.energy_kj).toBeNull();
    expect(result.energy_kcal).toBeNull();
    expect(result.fat).toBeNull();
    expect(result.saturated_fat).toBeNull();
    expect(result.carbohydrates).toBeNull();
    expect(result.sugars).toBeNull();
    expect(result.fibre).toBeNull();
    expect(result.protein).toBeNull();
    expect(result.salt).toBeNull();
    expect(result.data_source).toBe("off");
  });

  it("always sets data_source to off", () => {
    const nutriments: OFFNutriments = {
      energy_kj_100g: 100,
      energy_kcal_100g: 24,
      fat_100g: 0,
      saturated_fat_100g: 0,
      carbohydrates_100g: 5,
      sugars_100g: 3,
      fiber_100g: 1,
      proteins_100g: 1,
      salt_100g: 0,
    };

    const result = mapOFFNutrimentsToNutrition(nutriments, "b");

    expect(result.data_source).toBe("off");
    expect(result.nutrition_grade).toBe("b");
  });
});
