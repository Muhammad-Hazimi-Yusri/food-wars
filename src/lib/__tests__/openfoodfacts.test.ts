import { describe, it, expect, beforeEach, vi } from "vitest";
import { lookupBarcodeOFF } from "../openfoodfacts";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

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
    expect(mockFetch).toHaveBeenCalledWith(
      "https://world.openfoodfacts.org/api/v2/product/5000157024671.json",
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
