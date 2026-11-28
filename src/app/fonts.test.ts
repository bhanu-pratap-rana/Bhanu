import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

// A font called in the root layout is preloaded on every route (next/font
// docs, "Preloading"). Eczar's Devanagari file is only ever shown in the home
// hero (the Hindi name), so it must not be called from the layout.
describe("Eczar Devanagari preload scope", () => {
  it("keeps the root layout's Eczar Latin-only", () => {
    const layout = read("./layout.tsx");
    const call = layout.slice(layout.indexOf("Eczar({"), layout.indexOf("});", layout.indexOf("Eczar({")));
    expect(call).toContain('subsets: ["latin"]');
    expect(call).not.toContain("devanagari");
  });

  it("loads the Devanagari face from the hero module, which only the home page imports", () => {
    const fonts = read("../components/sections/hero-fonts.ts");
    expect(fonts).toContain('subsets: ["devanagari"]');
    expect(fonts).toContain('variable: "--font-eczar-deva"');
    const hero = read("../components/sections/Hero.tsx");
    expect(hero).toContain("eczarDeva.variable");
  });

  // --font-display is emitted on :root, where --font-eczar-deva is undefined,
  // so the Devanagari face is put in front of it on the element itself.
  it("puts the Devanagari face first on the lockup's Hindi line", () => {
    const css = read("./hero.css");
    const block = css.slice(css.indexOf(".lockup-deva {"), css.indexOf("}", css.indexOf(".lockup-deva {")));
    expect(block).toContain("font-family: var(--font-eczar-deva), var(--font-display);");
  });
});
