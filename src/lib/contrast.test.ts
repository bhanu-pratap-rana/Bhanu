import { describe, expect, it } from "vitest";
import { contrastRatio, parseHex, relativeLuminance } from "./contrast";

describe("parseHex", () => {
  it("reads #rrggbb and #rgb, any case", () => {
    expect(parseHex("#ff8000")).toEqual([255, 128, 0]);
    expect(parseHex("#FFF")).toEqual([255, 255, 255]);
    expect(parseHex("  #0a1024 ")).toEqual([10, 16, 36]);
  });

  it("rejects anything that is not a hex colour", () => {
    expect(() => parseHex("red")).toThrow();
    expect(() => parseHex("#12345")).toThrow();
    expect(() => parseHex("#ggg")).toThrow();
  });
});

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
  });

  it("uses the WCAG 2 channel weights", () => {
    expect(relativeLuminance("#ff0000")).toBeCloseTo(0.2126, 4);
    expect(relativeLuminance("#00ff00")).toBeCloseTo(0.7152, 4);
    expect(relativeLuminance("#0000ff")).toBeCloseTo(0.0722, 4);
  });

  it("linearises below the sRGB knee", () => {
    // 10/255 = 0.0392 <= 0.04045: linear part, c / 12.92.
    expect(relativeLuminance("#0a0a0a")).toBeCloseTo(10 / 255 / 12.92, 6);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white, in either order", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 6);
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 6);
  });

  it("is 1 for a colour on itself", () => {
    expect(contrastRatio("#777777", "#777777")).toBe(1);
  });

  it("matches a known pair (#767676 on white is the 4.5:1 grey)", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
});
