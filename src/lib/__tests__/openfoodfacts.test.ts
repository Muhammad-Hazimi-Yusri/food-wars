import { describe, it, expect, beforeEach, vi } from "vitest";
import { lookupBarcodeOFF } from "../openfoodfacts";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const FIELDS_PARAM =
  "fields=product_name,product_name_en,image_front_url,image_front_small_url,brands,quantity,nutriments,nutrition_grades,categories,ingredients_text,stores";

describe("openfoodfacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns product data when barcode is found", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 1,
          product: {
            product_name: "Heinz Baked Beans",
            image_front_url: "https://images.off.org/1234.jpg",
            brands: "Heinz",
            quantity: "415 g",
            nutriments: {
              "energy-kj_100g": 340,
              "energy-kcal_100g": 81,
              fat_100g: 0.2,
              "saturated-fat_100g": 0.1,
              carbohydrates_100g: 12.9,
              sugars_100g: 5.9,
              fiber_100g: 3.7,
              proteins_100g: 4.7,
              salt_100g: 1.1,
            },
            nutrition_grades: "a",
            categories: "Canned foods, Baked beans",
            ingredients_text: "Beans (51%), Tomatoes (34%), Water, Sugar",
            stores: "Tesco, Sainsbury's",
          },
        }),
    });

    const result = await lookupBarcodeOFF("5000157024671");

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Heinz Baked Beans");
    expect(result!.imageUrl).toBe("https://images.off.org/1234.jpg");
    expect(result!.brands).toBe("Heinz");
    expect(result!.quantity).toBe("415 g");
    expect(result!.barcode).toBe("5000157024671");

    // New fields
    expect(result!.nutriments).toEqual({
      energy_kj_100g: 340,
      energy_kcal_100g: 81,
      fat_100g: 0.2,
      saturated_fat_100g: 0.1,
      carbohydrates_100g: 12.9,
      sugars_100g: 5.9,
      fiber_100g: 3.7,
      proteins_100g: 4.7,
      salt_100g: 1.1,
    });
    expect(result!.nutritionGrade).toBe("a");
    expect(result!.categories).toBe("Canned foods, Baked beans");
    expect(result!.ingredientsText).toBe(
      "Beans (51%), Tomatoes (34%), Water, Sugar"
    );
    expect(result!.stores).toBe("Tesco, Sainsbury's");

    expect(mockFetch).toHaveBeenCalledWith(
      `https://world.openfoodfacts.org/api/v2/product/5000157024671.json?${FIELDS_PARAM}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("falls back to product_name_en when product_name is empty", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 1,
          product: {
            product_name: "",
            product_name_en: "Coca-Cola",
            image_front_url: null,
            image_front_small_url: "https://images.off.org/small.jpg",
            brands: null,
            quantity: null,
          },
        }),
    });

    const result = await lookupBarcodeOFF("5449000000996");

    expect(result!.name).toBe("Coca-Cola");
    expect(result!.imageUrl).toBe("https://images.off.org/small.jpg");
  });

  it("handles missing nutriments gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 1,
          product: {
            product_name: "Unknown Product",
          },
        }),
    });

    const result = await lookupBarcodeOFF("1234567890123");

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Unknown Product");
    expect(result!.nutriments).toBeNull();
    expect(result!.nutritionGrade).toBeNull();
    expect(result!.categories).toBeNull();
    expect(result!.ingredientsText).toBeNull();
    expect(result!.stores).toBeNull();
  });

  it("handles partial nutriments (some fields missing)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 1,
          product: {
            product_name: "Simple Product",
            nutriments: {
              "energy-kcal_100g": 200,
              fat_100g: 5.0,
              // rest missing
            },
          },
        }),
    });

    const result = await lookupBarcodeOFF("1111111111111");

    expect(result!.nutriments).toEqual({
      energy_kj_100g: null,
      energy_kcal_100g: 200,
      fat_100g: 5.0,
      saturated_fat_100g: null,
      carbohydrates_100g: null,
      sugars_100g: null,
      fiber_100g: null,
      proteins_100g: null,
      salt_100g: null,
    });
  });

  it("returns null when barcode is not found (status 0)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 0, product: null }),
    });

    const result = await lookupBarcodeOFF("0000000000000");

    expect(result).toBeNull();
  });

  it("returns null on HTTP error (404)", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    const result = await lookupBarcodeOFF("9999999999999");

    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await lookupBarcodeOFF("1234567890123");

    expect(result).toBeNull();
  });

  it("returns null on timeout", async () => {
    mockFetch.mockRejectedValue(new DOMException("Aborted", "AbortError"));

    const result = await lookupBarcodeOFF("1234567890123");

    expect(result).toBeNull();
  });
});
