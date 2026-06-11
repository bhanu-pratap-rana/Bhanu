import type { ReactNode } from "react";

export function Badge({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className="rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-600">
      {children}
    </span>
  );
}
