import { describe, it, expect } from "vitest";
import { detectStoreBrand } from "../store-brand-map";

describe("detectStoreBrand", () => {
  it("detects Tesco brand", () => {
    expect(detectStoreBrand("Tesco")).toBe("Tesco");
  });

  it("detects Tesco sub-brand", () => {
    expect(detectStoreBrand("Tesco Finest")).toBe("Tesco");
  });

  it("detects Tesco Everyday Value", () => {
    expect(detectStoreBrand("Tesco Everyday Value")).toBe("Tesco");
  });

  it("detects Aldi brand", () => {
    expect(detectStoreBrand("Aldi")).toBe("Aldi");
  });

  it("detects Sainsbury's brand", () => {
    expect(detectStoreBrand("Sainsbury's")).toBe("Sainsbury's");
  });

  it("detects Sainsbury without apostrophe", () => {
    expect(detectStoreBrand("Sainsbury")).toBe("Sainsbury's");
  });

  it("detects M&S brand", () => {
    expect(detectStoreBrand("M&S")).toBe("M&S");
  });

  it("detects Marks & Spencer brand", () => {
    expect(detectStoreBrand("Marks & Spencer")).toBe("M&S");
  });

  it("detects ASDA Extra Special (case-insensitive)", () => {
    expect(detectStoreBrand("ASDA Extra Special")).toBe("Asda");
  });

  it("returns null for non-store brand", () => {
    expect(detectStoreBrand("Heinz")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(detectStoreBrand("")).toBeNull();
  });

  it("detects store brand within a comma-separated list", () => {
    expect(detectStoreBrand("Hearty Food Co., Aldi")).toBe("Aldi");
  });

  it("detects Co-op brand", () => {
    expect(detectStoreBrand("Co-op")).toBe("Co-op");
  });

  it("detects Lidl brand", () => {
    expect(detectStoreBrand("Lidl")).toBe("Lidl");
  });

  it("detects Waitrose brand", () => {
    expect(detectStoreBrand("Waitrose")).toBe("Waitrose");
  });
});
