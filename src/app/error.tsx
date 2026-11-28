"use client";

import { useEffect } from "react";

// unstable_retry re-fetches the segment before re-rendering it, so a failed
// server render can recover; reset only re-renders what already failed.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main"
      tabIndex={-1}
      className="measure flex min-h-[60dvh] flex-col items-start justify-center gap-4 outline-none"
    >
      <h1 className="display text-[36px]">This page failed to load</h1>
      <p className="text-muted">
        Something broke while drawing it. Try again to load it afresh. Any
        conversation with the copilot is saved in this browser.
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="tap inline-flex items-center rounded-md bg-ink px-4 font-medium text-ground"
      >
        Try again
      </button>
    </main>
  );
}
