"use client";

import { useLayoutEffect } from "react";

/**
 * The inline script in Experience collapses roles 2–4 on phones before the
 * first paint of a full page load. React never runs that script after a
 * client-side navigation, so this does the same job when the section mounts.
 */
export function CollapseOnPhone({ selector }: Readonly<{ selector: string }>) {
  useLayoutEffect(() => {
    if (!window.matchMedia("(max-width: 63.99rem)").matches) return;
    document
      .querySelectorAll<HTMLDetailsElement>(selector)
      .forEach((details) => details.removeAttribute("open"));
  }, [selector]);
  return null;
}
