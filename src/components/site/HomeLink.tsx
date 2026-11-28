"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Mark() {
  return (
    <svg width="22" height="20" viewBox="0 0 30 26" aria-hidden="true" className="shrink-0">
      <polygon
        points="29,13 22,25.1 8,25.1 1,13 8,0.9 22,0.9"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.4"
      />
      <polygon points="21,13 18,18.2 12,18.2 9,13 12,7.8 18,7.8" fill="var(--accent)" />
    </svg>
  );
}

/**
 * The mark in the header: one hexagon, like a note in the copilot's memory.
 * On the home page the hero already carries the name, so only the mark shows.
 */
export function HomeLink({ name }: Readonly<{ name: string }>) {
  const pathname = usePathname();
  const home = pathname === "/";

  return (
    <span className="flex flex-1 items-center">
      <Link
        href={home ? "#top" : "/"}
        aria-label={home ? `${name}, back to the top` : undefined}
        className="tap inline-flex items-center gap-2.5 font-semibold"
      >
        <Mark />
        {home ? null : <span>{name}</span>}
      </Link>
    </span>
  );
}
