"use client";

import { useLayoutEffect } from "react";
import { openAll, roleIdFromHref } from "@/lib/role-disclosure";

const PHONE = "(max-width: 63.99rem)";

function openRole(id: string | null) {
  if (!id) return;
  const details = document.getElementById(id)?.querySelector("details");
  if (details) details.open = true;
}

/**
 * Keeps Experience's "What I did" disclosures out of the reader's way without
 * hiding anything they were sent to:
 * - phones keep only the first role open (the inline script does this before
 *   the first paint of a full load; React never re-runs that script after a
 *   client-side navigation, so this repeats it on mount);
 * - a role named by the URL hash, a clicked link or a focus move (citations
 *   and "Go to the section" focus the role's <li>) opens;
 * - printing opens every role and puts them back afterwards.
 */
export function RoleDisclosures({ roleIds }: Readonly<{ roleIds: readonly string[] }>) {
  useLayoutEffect(() => {
    const section = document.getElementById("experience");
    if (!section) return;

    if (window.matchMedia(PHONE).matches) {
      section
        .querySelectorAll<HTMLDetailsElement>("details[data-collapse]")
        .forEach((details) => {
          details.open = false;
        });
    }
    openRole(roleIdFromHref(window.location.hash, roleIds));

    // Next's <Link> changes the URL with pushState, which fires no hashchange,
    // so links are read on click (capture: before the router scrolls to the
    // role, so it lands with the role already expanded).
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (link) openRole(roleIdFromHref(link.getAttribute("href") ?? "", roleIds));
    };
    const onHashChange = () => openRole(roleIdFromHref(window.location.hash, roleIds));
    // Only focus on the role's own <li>: opening on focus of the summary would
    // fight a keyboard user trying to close it.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Element | null;
      if (target instanceof HTMLLIElement && roleIds.includes(target.id)) {
        openRole(target.id);
      }
    };

    let restore: (() => void) | null = null;
    const onBeforePrint = () => {
      restore?.();
      restore = openAll(Array.from(section.querySelectorAll("details")));
    };
    const onAfterPrint = () => {
      restore?.();
      restore = null;
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("hashchange", onHashChange);
    section.addEventListener("focusin", onFocusIn);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("hashchange", onHashChange);
      section.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [roleIds]);

  return null;
}
