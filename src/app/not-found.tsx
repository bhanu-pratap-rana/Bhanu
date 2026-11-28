import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="measure flex min-h-[60dvh] flex-col items-start justify-center gap-4 outline-none"
    >
      <h1 className="display text-[36px]">There is no page at this address</h1>
      <p className="text-muted">
        It may have moved. The home page lists all of the work, and the copilot
        can point you to the right part.
      </p>
      <Link href="/" className="tap inline-flex items-center rounded-md bg-ink px-4 font-medium text-ground">
        Go to the home page
      </Link>
    </main>
  );
}
