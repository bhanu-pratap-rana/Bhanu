"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useChat } from "@/components/chat/ChatProvider";
import { NOTE_COUNT, windowedQuestions } from "@/lib/chat-store";
import { captionFor } from "@/lib/index-caption";
import { deriveIndexView, type IndexView } from "@/lib/index-view";
import {
  getKnowledgeItem,
  kindLabel,
  knowledgeBase,
  shortTitle,
  starterQuestions,
} from "@/lib/knowledge";
import { kagomeLayout } from "@/lib/lattice";

// One cell per note the copilot can retrieve, in page order, laid out as a
// star-and-hexagon lattice. Two declared sizes of the same layout: the full
// lattice (cells are tappable) and a two-row strip that only reports state.
const FULL = kagomeLayout(NOTE_COUNT, 7, 20);
const STRIP = kagomeLayout(NOTE_COUNT, 14, 20);

const REST_QUESTION = starterQuestions[0].question;

export function useIndexView(): { view: IndexView; busy: boolean } {
  const draft = useChat((state) => state.draft);
  const preview = useChat((state) => state.preview);
  const messages = useChat((state) => state.messages);
  const busy = useChat((state) => state.status !== "idle");
  const deferredDraft = useDeferredValue(draft);

  const view = useMemo(() => {
    // The same window the server will retrieve over, minus the draft itself.
    const questions = deferredDraft.trim()
      ? windowedQuestions(messages, deferredDraft).slice(0, -1)
      : [];
    const answer = [...messages]
      .reverse()
      .find((message) => message.kind === "answer");
    return deriveIndexView({
      draft: deferredDraft,
      preview,
      questions,
      answer: answer
        ? {
            content: answer.content,
            sources: answer.sources ?? [],
            declined: answer.provider === "guard",
          }
        : undefined,
      restQuestion: REST_QUESTION,
    });
  }, [deferredDraft, preview, messages]);

  return { view, busy };
}

export function IndexLattice({
  size,
  selectedId,
  onSelect,
}: Readonly<{
  size: "full" | "strip";
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}>) {
  const { view, busy } = useIndexView();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const layout = size === "full" ? FULL : STRIP;
  const interactive = size === "full" && Boolean(onSelect);
  const hovered = hoverId ? getKnowledgeItem(hoverId) : undefined;

  return (
    <div>
      {/* The drawing is a picture of state that the caption and the note list
          below also give in words, so it is hidden from assistive tech. */}
      <svg
        className="lattice"
        viewBox={`-2 -2 ${layout.width + 4} ${layout.height + 4}`}
        aria-hidden="true"
        focusable="false"
        preserveAspectRatio="xMinYMid meet"
        onMouseLeave={() => setHoverId(null)}
      >
        {layout.cells.map((cell) => {
          const item = knowledgeBase[cell.index];
          const state = view.cells[item.id];
          return (
            <g
              key={item.id}
              className={interactive ? "cell-hit" : undefined}
              onMouseEnter={interactive ? () => setHoverId(item.id) : undefined}
              onClick={interactive ? () => onSelect?.(item.id) : undefined}
            >
              <polygon
                className="cell"
                points={cell.points}
                data-level={state?.level ?? 0}
                data-pulled={state?.pulled ? "true" : undefined}
                data-cited={state?.cite ? "true" : undefined}
                data-selected={selectedId === item.id ? "true" : undefined}
              />
              {state?.cite && size === "full" ? (
                <text className="cell-num" x={cell.cx} y={cell.cy}>
                  {state.cite}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <p
        className={`mt-2 text-[14px] leading-[1.4] text-ink ${
          size === "full" ? "min-h-[2.8em]" : "min-h-[1.4em]"
        }`}
      >
        {hovered
          ? `${shortTitle(hovered)} (${kindLabel[hovered.kind].toLowerCase()})`
          : captionFor(view, busy, size === "strip")}
      </p>
    </div>
  );
}
