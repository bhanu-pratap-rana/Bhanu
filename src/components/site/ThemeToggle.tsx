"use client";

import { Moon, Sun } from "lucide-react";

const COLORS = { light: "#eef1fb", dark: "#060a1c" } as const;

/**
 * Light / dark switch. Both icons are always rendered and CSS shows the one
 * for the current theme, so the server markup never depends on a stored
 * choice and there is nothing to mismatch on hydration.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    // Night is the default when nothing was chosen.
    const current = root.getAttribute("data-theme") ?? "dark";
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute("content", COLORS[next]));
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* the choice just lasts for this visit */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark theme"
      className="tap-square inline-flex items-center justify-center rounded-md text-ink"
    >
      <Moon size={19} aria-hidden="true" className="theme-icon-light" />
      <Sun size={19} aria-hidden="true" className="theme-icon-dark" />
    </button>
  );
}
