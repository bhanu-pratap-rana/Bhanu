import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// The owner's rule: the word is written plain, "Resume", everywhere a visitor
// or the model can read it. Comments count too, so the spelling cannot creep
// back in by copy and paste. Tests are excluded: they may quote the old
// spelling to check it is gone or handled.
const SRC = join(__dirname, "..");
const SCANNED = /\.(?:ts|tsx|css)$/;
const TEST = /\.test\.tsx?$/;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return SCANNED.test(entry.name) && !TEST.test(entry.name) ? [path] : [];
  });
}

describe('plain "Resume" spelling', () => {
  it("finds the source files it scans", () => {
    expect(files(SRC).length).toBeGreaterThan(20);
  });

  it('never writes "résumé" in src/ (tests excluded)', () => {
    const hits = files(SRC).flatMap((path) =>
      readFileSync(path, "utf8")
        // Composed form, so an "e" plus a combining accent is caught as well.
        .normalize("NFC")
        .split("\n")
        .flatMap((line, index) =>
          /ésumé|ésume|resumé/i.test(line) ? [`${relative(SRC, path)}:${index + 1}`] : [],
        ),
    );
    expect(hits).toEqual([]);
  });

  it('never writes "résumé" in the public text files crawlers and agents read', () => {
    const publicDir = join(SRC, "..", "public");
    const texts = readdirSync(publicDir).filter((name) => name.endsWith(".txt"));
    expect(texts).toContain("llms.txt");
    const hits = texts.flatMap((name) =>
      readFileSync(join(publicDir, name), "utf8")
        .normalize("NFC")
        .split("\n")
        .flatMap((line, index) => (/ésumé|ésume|resumé/i.test(line) ? [`public/${name}:${index + 1}`] : [])),
    );
    expect(hits).toEqual([]);
  });
});
