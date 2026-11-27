"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useRef, useState } from "react";
import { useChatStore } from "@/components/chat/ChatProvider";
import { basisLabel, kindLabel, type KnowledgeItem } from "@/lib/knowledge";

/** One note from the index, opened from a lattice cell or a source chip. */
export function NoteDetail({
  item,
  number,
  onClose,
}: Readonly<{
  item: KnowledgeItem;
  /** Citation number when opened from an answer's sources. */
  number?: number;
  onClose: () => void;
}>) {
  const store = useChatStore();
  // The control that opened this note, so closing it can hand focus back.
  const [opener] = useState(() =>
    typeof document === "undefined"
      ? null
      : (document.activeElement as HTMLElement | null),
  );
  const closedRef = useRef(false);
  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  };

  return (
    <div className="rounded-md border border-control bg-ground p-3 text-[15px] leading-[1.5]">
      <div className="flex items-start gap-2">
        {number ? <span className="cite mt-0.5">{number}</span> : null}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{item.title}</p>
          <p className="text-[13px] text-muted">
            {kindLabel[item.kind]}. {basisLabel[item.basis]}.
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={`Close note: ${item.title}`}
          className="tap-square -mr-2 -mt-2 inline-flex items-center justify-center rounded-md text-muted hover:text-ink"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="mt-2 text-ink">{item.summary}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={() => {
            onClose();
            void store.ask(item.prompt);
          }}
          className="link tap inline-flex items-center text-left font-medium"
        >
          Ask about this
        </button>
        <Link
          href={`/#${item.anchor}`}
          onClick={() => store.close()}
          className="link tap inline-flex items-center font-medium"
        >
          Go to the section
        </Link>
      </div>
    </div>
  );
}
