import { useEffect, useMemo, useRef, useState } from "react";
import { knowledgeBase, type SourceRef } from "@/lib/knowledge";
import type { ChatMode } from "@/lib/rag";
import { prefersReducedMotion, scrollBehavior } from "@/lib/motion";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
  provider?: string;
};

const STORAGE_KEY = "bhanu-copilot-conversation";

export const starterMessage: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello, I'm Bhanu Copilot. Ask me about Bhanu's projects, RAG systems, production AI work, architecture choices, research, or resume.",
  sources: knowledgeBase.slice(0, 3),
  provider: "profile-index",
};

function readSourcesHeader(value: string | null): SourceRef[] | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(decodeURIComponent(value)) as SourceRef[];
  } catch {
    return undefined;
  }
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([starterMessage]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ChatMode>("default");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const latestSources = useMemo(() => {
    return [...messages].reverse().find((message) => message.sources?.length)
      ?.sources;
  }, [messages]);

  // Restore a prior conversation on mount (client-only).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // A lazy useState initializer cannot read localStorage without an SSR
          // hydration mismatch, so post-mount setState is the correct pattern.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setMessages(parsed);
        }
      }
    } catch {
      /* localStorage unavailable — start fresh */
    }
  }, []);

  // Persist the conversation so a refresh does not wipe it.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore quota / privacy-mode failures */
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: scrollBehavior(prefersReducedMotion()),
      block: "end",
    });
  }, [messages, isLoading]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let assistantId: string | null = null;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      });

      const provider = response.headers.get("x-provider") ?? undefined;
      const sources = readSourcesHeader(response.headers.get("x-sources"));

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        let message = errorText || "I could not answer that request.";
        try {
          const errorJson = JSON.parse(errorText) as { error?: string };
          message = errorJson.error ?? message;
        } catch {
          // Plain-text errors can be shown directly.
        }

        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: message,
            sources,
            provider,
          },
        ]);
        return;
      }

      assistantId = crypto.randomUUID();
      setStreamingId(assistantId);
      setMessages((current) => [
        ...current,
        {
          id: assistantId as string,
          role: "assistant",
          content: "",
          sources,
          provider,
        },
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) {
          const chunk = decoder.decode(result.value, { stream: true });
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: `${message.content}${chunk}` }
                : message,
            ),
          );
        }
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content:
                  message.content.trim() ||
                  "I could not answer that request. Please try again.",
              }
            : message,
        ),
      );
    } catch (error) {
      const aborted =
        error instanceof DOMException && error.name === "AbortError";
      if (aborted) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId && !message.content.trim()
              ? { ...message, content: "Generation stopped." }
              : message,
          ),
        );
      } else {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              "I could not reach the copilot route. Check the local dev server and try again.",
          },
        ]);
      }
    } finally {
      abortRef.current = null;
      setStreamingId(null);
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function stopGenerating() {
    abortRef.current?.abort();
  }

  function startNewChat() {
    abortRef.current?.abort();
    setMessages([starterMessage]);
    setInput("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    inputRef.current?.focus();
  }

  async function copyMessage(id: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return {
    messages,
    input,
    setInput,
    mode,
    setMode,
    isLoading,
    streamingId,
    copiedId,
    latestSources,
    inputRef,
    messagesEndRef,
    ask,
    stopGenerating,
    startNewChat,
    copyMessage,
  };
}
