"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="measure flex min-h-[60dvh] flex-col items-start justify-center gap-4 outline-none"
    >
      <h1 className="display text-[36px]">This page failed to load</h1>
      <p className="text-muted">
        Something broke while drawing it. Reload to try again. Any conversation
        with the copilot is saved in this browser.
      </p>
      <button
        type="button"
        onClick={reset}
        className="tap inline-flex items-center rounded-md bg-ink px-4 font-medium text-ground"
      >
        Reload the page
      </button>
    </main>
  );
}
