// Which "What I did" disclosures in Experience start open, and when a closed
// one must open by itself. Kept free of the DOM so the rules can be tested.

/** How many of the most recent roles the server renders open. */
export const ROLES_OPEN_BY_DEFAULT = 2;

/** The server markup: the latest roles open, older ones collapsed. */
export function openByDefault(index: number): boolean {
  return index < ROLES_OPEN_BY_DEFAULT;
}

/** A phone has room for one open role before the reader has to scroll. */
export function collapsesOnPhone(index: number): boolean {
  return index > 0;
}

/**
 * The role a link or URL hash points at on the home page, or null. A citation
 * or "Go to the section" link lands on the role's <li>; its details must open
 * or the reader arrives at a heading with the evidence folded away.
 */
export function roleIdFromHref(href: string, roleIds: readonly string[]): string | null {
  const at = href.indexOf("#");
  if (at < 0) return null;

  // Only same-page hashes or links to the home page: a role id on another
  // route is not an element on this one.
  const before = href.slice(0, at);
  if (before !== "" && !/^(?:[a-z][a-z\d+.-]*:\/\/[^/]+)?\/?$/i.test(before)) {
    return null;
  }

  let id: string;
  try {
    id = decodeURIComponent(href.slice(at + 1));
  } catch {
    return null;
  }
  return roleIds.includes(id) ? id : null;
}

/**
 * Opens every disclosure (for printing) and returns a function that puts each
 * one back as it was. The restore runs once, so a stray second afterprint
 * cannot undo what the reader opened since.
 */
export function openAll(items: readonly { open: boolean }[]): () => void {
  const before = items.map((item) => item.open);
  for (const item of items) item.open = true;
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    items.forEach((item, index) => {
      item.open = before[index];
    });
  };
}
