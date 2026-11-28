"use client";

import { ArrowUp, Square } from "lucide-react";
import { useEffect, useRef, type FormEvent } from "react";
import { useChat, useChatStore } from "@/components/chat/ChatProvider";
import { jobDescriptionPrompt } from "@/lib/knowledge";
import { acceptStopPress } from "@/lib/stop-guard";

const QUESTION_MAX = 1000;
const isJobDescription = (text: string) =>
  text.startsWith(jobDescriptionPrompt.trimEnd());
// Only the job-description path may be long; the server enforces the same cap.
const PASTE_MAX = 6000;

export function Composer() {
  const store = useChatStore();
  const draft = useChat((state) => state.draft);
  const busy = useChat((state) => state.status !== "idle");
  const focusRequest = useChat((state) => state.focusRequest);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Only requests made after this field mounted count; an old one must not
  // raise the phone keyboard every time the dialog opens.
  const seenRequest = useRef(focusRequest);

  const isPaste = isJobDescription(draft);
  const max = isPaste ? PASTE_MAX : QUESTION_MAX;
  const left = max - draft.length;
  const nearLimit = left < 200;

  const stopRef = useRef<HTMLButtonElement>(null);
  // Whether the Stop button held focus at the moment the answer ended. Read
  // from the store's own notification, which runs before React swaps the
  // button out, so it is still in the page and can be asked.
  const stopHadFocus = useRef(false);
  const wasBusy = useRef(busy);
  // When the current answer started (performance.now()), so a pointer press
  // that lands on Stop as part of the click that sent it can be ignored.
  const busySince = useRef<number | null>(null);

  useEffect(() => {
    let before = store.getState().status !== "idle";
    return store.subscribe(() => {
      const now = store.getState().status !== "idle";
      if (!before && now) busySince.current = performance.now();
      if (before && !now) {
        busySince.current = null;
        // Keyboard focus only: a tap on Stop (Android focuses tapped buttons)
        // must not pull the keyboard up over the answer just stopped.
        stopHadFocus.current =
          stopRef.current !== null &&
          document.activeElement === stopRef.current &&
          stopRef.current.matches(":focus-visible");
      }
      before = now;
    });
  }, [store]);

  // Removing the focused Stop button drops focus to the page; put it back in
  // the field the visitor will use next. Only when it was on Stop: a reader
  // whose focus was already nowhere keeps the page's own keyboard scrolling.
  useEffect(() => {
    const ended = wasBusy.current && !busy;
    wasBusy.current = busy;
    if (!ended || !stopHadFocus.current) return;
    stopHadFocus.current = false;
    const active = document.activeElement;
    if (active === document.body || active === stopRef.current) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [busy]);

  useEffect(() => {
    if (focusRequest === seenRequest.current) return;
    seenRequest.current = focusRequest;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [focusRequest]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    void store.ask(draft);
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <label htmlFor="copilot-input" className="sr-only">
        Ask about Bhanu
      </label>
      <div className="min-w-0 flex-1">
        <textarea
          id="copilot-input"
          ref={inputRef}
          value={draft}
          aria-describedby={nearLimit ? "copilot-count" : undefined}
          onChange={(event) => {
            // The cap depends on what is being typed, not on the last draft.
            const next = event.target.value;
            store.setDraft(
              next.slice(0, isJobDescription(next) ? PASTE_MAX : QUESTION_MAX),
            );
          }}
          onKeyDown={(event) => {
            // Enter also confirms a transliteration candidate when typing
            // Hindi; that must not send a half-written question.
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              event.keyCode !== 229
            ) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Ask about Bhanu’s work…"
          rows={isPaste ? 6 : 2}
          enterKeyHint="send"
          autoComplete="off"
          className="block w-full resize-none rounded-md border border-control bg-surface px-3 py-2.5 text-[16px] leading-[1.4] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ink"
        />
        {nearLimit ? (
          <p id="copilot-count" className="mt-1 text-[13px] text-muted">
            {draft.length} of {max} characters
            {left <= 0 ? ". Anything after this is cut." : "."}
          </p>
        ) : null}
        {isPaste ? (
          <p className="mt-1 text-[13px] leading-[1.4] text-muted">
            Pasted text is sent to the model to write the answer. This site
            does not store it.
          </p>
        ) : null}
      </div>
      {/* Separate keys, so Stop and Send are separate nodes: a Stop press that
          lands just as the answer ends must not become a Send of the draft. */}
      {busy ? (
        <button
          key="stop"
          ref={stopRef}
          type="button"
          // Send turns into Stop under the pointer: the second click of a
          // double-click on Send must not abort the answer it just asked for.
          // Keyboard and AT presses (detail 0) always stop (stop-guard.ts).
          onClick={(event) => {
            if (
              acceptStopPress({
                clickCount: event.detail,
                now: performance.now(),
                busySince: busySince.current,
              })
            ) {
              store.stop();
            }
          }}
          aria-label="Stop the answer"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-control text-ink"
        >
          <Square size={16} aria-hidden="true" />
        </button>
      ) : (
        <button
          key="send"
          type="submit"
          disabled={!draft.trim()}
          aria-label="Send question"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-ink text-ground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowUp size={20} aria-hidden="true" />
        </button>
      )}
      {/* Announced only at a few thresholds, not on every key press. */}
      <span role="status" className="sr-only">
        {left === 100 || left === 20
          ? `${left} characters left.`
          : left <= 0
            ? "Character limit reached."
            : ""}
      </span>
    </form>
  );
}
