"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createChatStore,
  DEEP_LINK_MAX,
  EMPTY_CHAT_STATE,
  type ChatState,
  type ChatStore,
} from "@/lib/chat-store";

const ChatContext = createContext<ChatStore | null>(null);

export function ChatProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [store] = useState(() => createChatStore());

  useEffect(() => {
    store.restore();

    // A shared `?q=` link only fills the composer. It never sends on its own:
    // a link someone else wrote must not spend the model quota or put words in
    // the copilot's mouth without the visitor pressing send.
    if (window.location.pathname !== "/") return;
    const params = new URLSearchParams(window.location.search);
    const question = params.get("q");
    if (!question) return;
    const clean = question
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .trim()
      .slice(0, DEEP_LINK_MAX);
    if (clean) {
      store.setDraft(clean);
      // On wide screens put the caret in the field so the visitor sees the
      // question is waiting; on phones the dialog stays closed until asked.
      if (window.matchMedia("(min-width: 64rem)").matches) store.requestFocus();
    }
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.hash,
    );
  }, [store]);

  return <ChatContext value={store}>{children}</ChatContext>;
}

export function useChatStore(): ChatStore {
  const store = useContext(ChatContext);
  if (!store) throw new Error("useChatStore must be used inside ChatProvider");
  return store;
}

/**
 * Subscribes to one slice of the chat state. The selector must return a
 * primitive or a reference taken straight from the state, so the snapshot is
 * stable between unrelated updates.
 */
export function useChat<T>(selector: (state: ChatState) => T): T {
  const store = useChatStore();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(EMPTY_CHAT_STATE),
  );
}

const DESKTOP_QUERY = "(min-width: 64rem)";

function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True when the copilot is a docked column rather than a dialog. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}
