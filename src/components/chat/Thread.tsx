"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useChat, useChatStore } from "@/components/chat/ChatProvider";
import { NoteDetail } from "@/components/chat/NoteDetail";
import { countCitations, MessageBody, stripCitations } from "@/components/markdown";
import { NOTE_COUNT, type ChatMessage } from "@/lib/chat-store";
import { modelLabel } from "@/lib/groq-models";
import { DEEP_LINK_MAX } from "@/lib/chat-store";
import {
  getKnowledgeItem,
  shortTitle,
  type KnowledgeItem,
} from "@/lib/knowledge";
import { langOf } from "@/lib/lang";

function seconds(ms: number | undefined): string | undefined {
  return ms === undefined ? undefined : `${(ms / 1000).toFixed(1)} s`;
}

function CopyButton({
  text,
  label,
  done,
}: Readonly<{ text: string; label: string; done: string }>) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button
        type="button"
        className="link tap inline-flex items-center text-[14px]"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard blocked: the text is still selectable */
          }
        }}
      >
        {copied ? done : label}
      </button>
      {/* Only the confirmation is announced; clearing it is silent. */}
      <span role="status" className="sr-only">
        {copied ? done : ""}
      </span>
    </>
  );
}

const Question = memo(function Question({
  message,
}: Readonly<{ message: ChatMessage }>) {
  return (
    <div className="flex justify-end" data-question>
      <p
        lang={langOf(message.content)}
        // Focusable so a long pasted question can be scrolled by keyboard,
        // and so focus can land here after the button that asked it is gone.
        tabIndex={message.content.length > 400 ? 0 : -1}
        className="max-h-44 max-w-[90%] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-hairline bg-ground px-3 py-2 text-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-ink"
      >
        <span className="sr-only">You asked: </span>
        {message.content}
      </p>
    </div>
  );
});

const Answer = memo(function Answer({
  message,
  question,
  streaming,
  isLast,
}: Readonly<{
  message: ChatMessage;
  question: string;
  streaming: boolean;
  isLast: boolean;
}>) {
  const store = useChatStore();
  const [openId, setOpenId] = useState<string | null>(null);
  // Set when a note is opened from a citation inside the text, which sits
  // below the note: move there, or the tap looks like it did nothing.
  const [fromCite, setFromCite] = useState(false);
  const noteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openId || !fromCite) return;
    noteRef.current?.scrollIntoView({ block: "nearest" });
    noteRef.current?.focus({ preventScroll: true });
  }, [openId, fromCite]);
  const sources = (message.sources ?? [])
    .map((id) => getKnowledgeItem(id))
    .filter((item): item is KnowledgeItem => Boolean(item));
  const { cited, outOfRange } = countCitations(message.content, sources.length);
  const openItem = openId ? getKnowledgeItem(openId) : undefined;
  const openNumber = openItem ? sources.indexOf(openItem) + 1 : 0;
  const followUps =
    isLast && !streaming
      ? sources.filter((_, index) => !cited.includes(index + 1)).slice(0, 2)
      : [];
  const label = modelLabel(message.provider);
  const fromModel = message.provider?.startsWith("groq:") ?? false;
  const shareUrl =
    typeof window === "undefined" || question.length > DEEP_LINK_MAX
      ? ""
      : `${window.location.origin}/?q=${encodeURIComponent(question)}`;

  return (
    <div className="space-y-3">
      {/* Sources sit above the answer and never move while it streams. */}
      <div>
        {/* The index caption above already says how many were pulled. */}
        <p
          className={
            sources.length > 0 && !message.reusedPrevious
              ? "sr-only"
              : "text-[14px] text-muted"
          }
        >
          {sources.length > 0
            ? `Pulled ${sources.length} of ${NOTE_COUNT} notes`
            : message.sourcesUnknown
              ? "The notes behind this answer cannot be shown on this version of the page. Reload to see them"
              : "No note matched, so the model saw only the one-line index"}
          {message.reusedPrevious
            ? ", kept from your previous question because this one had no new keywords."
            : "."}
        </p>
        {sources.length > 0 ? (
          <ol className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:-mx-6 lg:px-6">
            {sources.map((item, index) => {
              const number = index + 1;
              const isCited = cited.includes(number);
              return (
                <li key={item.id} className="shrink-0">
                  <button
                    type="button"
                    aria-expanded={openId === item.id}
                    aria-label={`Source ${number}: ${item.title}${isCited ? ", cited" : ""}`}
                    onClick={() => {
                      setFromCite(false);
                      setOpenId(openId === item.id ? null : item.id);
                    }}
                    className={`inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-left text-[14px] leading-[1.25] ${
                      openId === item.id
                        ? "border-ink bg-wash text-ink"
                        : isCited
                          ? "border-accent text-ink"
                          : "border-control text-muted"
                    }`}
                  >
                    <span
                      className={
                        isCited
                          ? "cite !mx-0"
                          : "inline-flex h-[1.3rem] min-w-[1.3rem] items-center justify-center text-[12.5px] font-semibold"
                      }
                    >
                      {number}
                    </span>
                    {shortTitle(item)}
                  </button>
                </li>
              );
            })}
          </ol>
        ) : null}
        {openItem ? (
          <div
            ref={noteRef}
            tabIndex={-1}
            className="mt-2 scroll-my-4 focus:outline-none"
          >
            <NoteDetail
              item={openItem}
              number={openNumber}
              onClose={() => setOpenId(null)}
            />
          </div>
        ) : null}
      </div>

      <div
        lang={langOf(message.content)}
        aria-busy={streaming}
        className="break-words text-ink"
      >
        {message.content ? (
          <MessageBody
            content={message.content}
            role="assistant"
            sourceCount={sources.length}
            renderCite={(number, key) => {
              const item = sources[number - 1];
              return (
                <button
                  key={key}
                  type="button"
                  className="cite"
                  aria-label={`Source ${number}: ${item?.title ?? ""}`}
                  aria-expanded={Boolean(item) && openId === item?.id}
                  onClick={() => {
                    setFromCite(true);
                    setOpenId(item && openId !== item.id ? item.id : null);
                  }}
                >
                  {number}
                </button>
              );
            }}
          />
        ) : (
          <p className="text-muted">
            {sources.length > 0
              ? `Reading ${sources.length} notes…`
              : "Checking the index…"}
          </p>
        )}
        {streaming && message.content ? (
          <span className="caret" aria-hidden="true" />
        ) : null}
      </div>

      {!streaming ? (
        <div className="space-y-2">
          <p className="text-[13px] leading-[1.4] text-muted">
            {label}
            {message.stopped ? " Stopped before the end." : ""}
            {label && !message.stopped ? "." : ""}
          </p>

          {followUps.length > 0 ? (
            <div className="flex flex-col items-start gap-1.5">
              {followUps.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void store.ask(item.prompt)}
                  className="tap rounded-md border border-control px-3 py-2 text-left text-[15px] leading-[1.35] text-ink hover:border-ink"
                >
                  {item.prompt}
                </button>
              ))}
            </div>
          ) : null}

          <details className="text-[14px] leading-[1.5] text-muted">
            <summary className="tap inline-flex cursor-pointer items-center text-ink">
              <span className="link">How this answer was made</span>
            </summary>
            <div className="mt-1 space-y-2 border-l-2 border-hairline pl-3">
              <p>
                {sources.length > 0
                  ? `The model was given ${sources.length} notes in full, chosen by keyword and tag match, plus a one-line index of all ${NOTE_COUNT}.`
                  : message.sourcesUnknown
                    ? "The server used notes this version of the page does not know, so they cannot be listed here. Reload the page to see them."
                    : `No note matched, so the model was given only a one-line index of all ${NOTE_COUNT} notes.`}
              </p>
              {sources.length > 0 ? (
                <ol className="space-y-0.5">
                  {sources.map((item, index) => {
                    const terms = message.matched?.[item.id] ?? [];
                    const score = message.scores?.[item.id];
                    return (
                      <li key={item.id}>
                        <span className="text-ink">
                          {index + 1}. {shortTitle(item)}
                        </span>
                        {score !== undefined ? `, score ${score}` : ""}
                        {terms.length > 0
                          ? `, matched on ${terms.join(", ")}`
                          : ""}
                      </li>
                    );
                  })}
                </ol>
              ) : null}
              {message.expansions && message.expansions.length > 0 ? (
                <p>
                  Words expanded before matching:{" "}
                  {message.expansions
                    .map(({ from, to }) => `${from} → ${to.join(", ")}`)
                    .join("; ")}
                  .
                </p>
              ) : null}
              <p>
                {fromModel
                  ? `Written by ${label}.`
                  : "The model was not available, so this is taken straight from the notes."}{" "}
                {cited.length > 0
                  ? `It cited ${cited.length} of the ${sources.length} notes.`
                  : ""}{" "}
                {outOfRange > 0
                  ? `${outOfRange} citation pointed at no note and is shown as plain text.`
                  : ""}
              </p>
              {message.firstTextMs !== undefined ? (
                <p>
                  First text after {seconds(message.firstTextMs)}
                  {message.totalMs !== undefined
                    ? `, finished in ${seconds(message.totalMs)}`
                    : ""}
                  , measured in your browser.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-x-4">
                <CopyButton
                  text={stripCitations(message.content)}
                  label="Copy the answer"
                  done="Answer copied"
                />
{shareUrl ? (
                <CopyButton
                  text={shareUrl}
                  label="Copy a link to this question"
                  done="Link copied"
                />
                ) : null}
              </div>
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
});

function Notice({ message }: Readonly<{ message: ChatMessage }>) {
  return (
    // Not a live region: the store announces the same text through the one
    // always-mounted status line, so it is heard once, dialog open or not.
    <p
      className="border-l-2 border-danger pl-3 text-[15px] leading-[1.5] text-ink"
    >
      {message.content}
    </p>
  );
}

export function Thread() {
  const messages = useChat((state) => state.messages);
  const streamingId = useChat((state) => state.streamingId);

  return (
    <div className="space-y-5">
      {messages.map((message, index) => {
        if (message.kind === "question") {
          return <Question key={message.id} message={message} />;
        }
        if (message.kind === "notice") {
          return <Notice key={message.id} message={message} />;
        }
        // An answer always follows the question it answers.
        const asked = messages
          .slice(0, index)
          .findLast((earlier) => earlier.kind === "question");
        return (
          <Answer
            key={message.id}
            message={message}
            question={asked?.content ?? ""}
            streaming={streamingId === message.id}
            isLast={index === messages.length - 1}
          />
        );
      })}
    </div>
  );
}
