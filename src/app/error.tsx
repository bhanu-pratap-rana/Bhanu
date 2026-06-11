"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#f4f3ef] px-6 text-center text-stone-800">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-stone-600">
        The copilot hit an unexpected error. Try again — your conversation is
        saved.
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex h-10 items-center rounded-md bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800"
      >
        Reload
      </button>
    </main>
  );
}
