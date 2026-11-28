"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Copies the address; the visible mailto link beside it is the fallback. */
export function CopyEmail({ email }: Readonly<{ email: string }>) {
  const [copied, setCopied] = useState(false);

  return (
    <>
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(email);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard blocked: the address is on screen to select */
        }
      }}
      className="tap inline-flex items-center justify-center gap-1.5 rounded-md text-[15px] text-muted hover:text-ink"
    >
      {copied ? (
        <Check size={17} aria-hidden="true" />
      ) : (
        <Copy size={17} aria-hidden="true" />
      )}
      {copied ? "Copied" : "Copy"}
      <span className="sr-only"> email address</span>
    </button>
    {/* Only the confirmation is announced; clearing it is silent. */}
    <span role="status" className="sr-only">
      {copied ? "Email address copied" : ""}
    </span>
    </>
  );
}
