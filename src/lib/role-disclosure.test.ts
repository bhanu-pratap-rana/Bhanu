import { describe, expect, it } from "vitest";
import { experience } from "./knowledge";
import {
  collapsesOnPhone,
  openAll,
  openByDefault,
  roleIdFromHref,
} from "./role-disclosure";

const ids = experience.map((role) => role.id);

describe("openByDefault", () => {
  it("opens the two most recent roles and closes the rest", () => {
    expect([0, 1, 2, 3].map(openByDefault)).toEqual([true, true, false, false]);
  });
});

describe("collapsesOnPhone", () => {
  it("keeps only the first role open on a phone", () => {
    expect([0, 1, 2].map(collapsesOnPhone)).toEqual([false, true, true]);
  });
});

describe("roleIdFromHref", () => {
  it("reads a bare hash", () => {
    expect(roleIdFromHref("#experience-khs", ids)).toBe("experience-khs");
  });

  it("reads the hash of a home-page link and of a full URL", () => {
    expect(roleIdFromHref("/#experience-bytical", ids)).toBe("experience-bytical");
    expect(
      roleIdFromHref("https://example.com/#experience-testneo", ids),
    ).toBe("experience-testneo");
  });

  it("decodes an encoded hash", () => {
    expect(roleIdFromHref("#experience%2Dkhs", ids)).toBe("experience-khs");
  });

  it("ignores hashes that are not a role", () => {
    expect(roleIdFromHref("#experience", ids)).toBeNull();
    expect(roleIdFromHref("#work-atal", ids)).toBeNull();
    expect(roleIdFromHref("", ids)).toBeNull();
    expect(roleIdFromHref("#", ids)).toBeNull();
    expect(roleIdFromHref("/projects/atal", ids)).toBeNull();
  });

  it("ignores links to a role on another page", () => {
    expect(roleIdFromHref("/projects/atal#experience-khs", ids)).toBeNull();
  });

  it("survives a malformed escape", () => {
    expect(roleIdFromHref("#%E0%A4%A", ids)).toBeNull();
  });
});

describe("openAll", () => {
  it("opens every disclosure and restores each one's own state", () => {
    const items = [{ open: true }, { open: false }, { open: false }];
    const restore = openAll(items);
    expect(items.map((item) => item.open)).toEqual([true, true, true]);
    restore();
    expect(items.map((item) => item.open)).toEqual([true, false, false]);
  });

  it("restores only once, so a second afterprint is harmless", () => {
    const items = [{ open: false }];
    const restore = openAll(items);
    restore();
    items[0].open = true; // the reader opened it after printing
    restore();
    expect(items[0].open).toBe(true);
  });
});
