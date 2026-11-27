"use client";

import { useChat } from "@/components/chat/ChatProvider";
import { countCitations } from "@/components/markdown";
import type { ChatState } from "@/lib/chat-store";

/**
 * 0 = the latest answer did not use this note; -1 = it was given to the model
 * but not cited; n > 0 = it is cited as source n. A number, so the snapshot
 * stays stable while unrelated tokens stream in.
 */
function markFor(state: ChatState, ids: readonly string[]): number {
  const answer = state.messages.findLast((message) => message.kind === "answer");
  const sources = answer?.sources;
  if (!answer || !sources) return 0;

  let pulled = false;
  for (const id of ids) {
    const position = sources.indexOf(id);
    if (position === -1) continue;
    pulled = true;
    const number = position + 1;
    if (countCitations(answer.content, sources.length).cited.includes(number)) {
      return number;
    }
  }
  return pulled ? -1 : 0;
}

/**
 * Marks a row on the page that the copilot's latest answer drew on, with the
 * same number the answer cites it by. This is the only place the accent colour
 * appears outside the copilot: it always means "the copilot touched this".
 */
export function PulledMark({
  ids,
}: Readonly<{ ids: readonly string[] }>) {
  const mark = useChat((state) => markFor(state, ids));
  if (mark === 0) return null;

  return mark > 0 ? (
    <span className="cite ml-2 align-middle" title="Cited in the copilot’s last answer">
      {mark}
      <span className="sr-only">: cited by the copilot in its last answer</span>
    </span>
  ) : (
    <span className="ml-2 inline-block align-middle" title="Read by the copilot for its last answer">
      <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden="true">
        <polygon
          points="17,8 12.5,15 5.5,15 1,8 5.5,1 12.5,1"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
        />
      </svg>
      <span className="sr-only">Read by the copilot for its last answer</span>
    </span>
  );
}
