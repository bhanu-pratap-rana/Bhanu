import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

/**
 * Size caps per rendition (bytes): the portrait must stay cheap. Keys are
 * the width in the file name; "hex2-…" files hold the head-and-shoulders
 * framing made for the hexagon (2 : sqrt3) canvas. The number after "hex" is
 * a version: a new framing gets new file names, so no cache serves the old one.
 */
const CAPS: Record<string, number> = {
  "800": 120 * 1024,
  "256": 30 * 1024,
  "96": 10 * 1024,
  "hex2-1200": 90 * 1024,
  "hex2-960": 60 * 1024,
  "hex2-480": 20 * 1024,
  "hex2-240": 8 * 1024,
};

/** "bhanu-hex2-480.webp" -> "hex2-480"; "bhanu-800.jpg" -> "800". */
function capKey(name: string): string {
  return name.match(/bhanu-((?:hex\d*-)?\d+)\./)?.[1] ?? "";
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

const referenced = [
  ...new Set(
    sourceFiles(join(root, "src")).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/portrait\/(bhanu-(?:hex\d*-)?\d+\.(?:webp|jpg))/g)].map(
        (m) => m[1],
      ),
    ),
  ),
].sort();

describe("portrait files", () => {
  it("is referenced from the code", () => {
    expect(referenced.length).toBeGreaterThan(0);
  });

  it.each(referenced)("%s exists in public/portrait and is under its size cap", (name) => {
    const path = join(root, "public", "portrait", name);
    expect(existsSync(path)).toBe(true);
    const key = capKey(name);
    expect(CAPS[key], `no cap for ${name}`).toBeDefined();
    expect(statSync(path).size).toBeLessThan(CAPS[key]);
  });

  it("keeps every rendition in public/portrait under its cap", () => {
    for (const name of readdirSync(join(root, "public", "portrait"))) {
      const key = capKey(name);
      expect(key && CAPS[key], `unexpected file ${name}`).toBeTruthy();
      expect(statSync(join(root, "public", "portrait", name)).size).toBeLessThan(CAPS[key]);
    }
  });

  it("hex renditions have the hexagon box's 2 : sqrt3 shape, so object-cover shows the whole photo", () => {
    for (const name of readdirSync(join(root, "public", "portrait"))) {
      if (!/^bhanu-hex\d*-/.test(name) || !name.endsWith(".webp")) continue;
      const buf = readFileSync(join(root, "public", "portrait", name));
      // WebP VP8 (lossy) header: width/height are 14-bit fields at bytes 26-29.
      expect(buf.toString("ascii", 12, 16)).toBe("VP8 ");
      const w = buf.readUInt16LE(26) & 0x3fff;
      const h = buf.readUInt16LE(28) & 0x3fff;
      expect(Math.abs(h / w - Math.sqrt(3) / 2)).toBeLessThan(0.005);
    }
  });
});
