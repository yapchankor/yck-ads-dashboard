"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageSquare, Send, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { recommendationToActionPreview } from "@/lib/action-types";
import { AssistantMarkdown } from "@/components/ui/AssistantMarkdown";
import {
  DEFAULT_RESPONSE_STYLE,
  findRecommendationById,
  type ResponseStyle,
} from "@/lib/chat-contract";
import { getActiveClient } from "@/lib/client-config";
import {
  getConversationStarters,
  getCopilotStyleStorageKey,
  normalizeStoredResponseStyle,
} from "@/lib/copilot-experience";
import type { ActionPreview, DashboardData } from "@/lib/types";
import { ActionDrawer } from "./ActionDrawer";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  recommendationId?: string | null;
  retryPrompt?: string;
};

const GREETING =
  "Hi, I'm your ads assistant. Ask how your campaigns are doing, what to improve, or ask me to create ad copy.";

const RESPONSE_STYLE_OPTIONS: Array<{ value: ResponseStyle; label: string }> = [
  { value: "direct", label: "Direct" },
  { value: "balanced", label: "Balanced" },
  { value: "conversational", label: "Conversational" },
];

export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>(DEFAULT_RESPONSE_STYLE);
  const [openingRecommendationId, setOpeningRecommendationId] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionPreview | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<DashboardData["metrics"]>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const client = getActiveClient();
  const styleStorageKey = getCopilotStyleStorageKey(client.key);
  const conversationStarters = getConversationStarters(pathname);
  const hasStartedConversation = messages.some((message) => message.role === "user");

  useEffect(() => {
    try {
      setResponseStyle(normalizeStoredResponseStyle(window.localStorage.getItem(styleStorageKey)));
    } catch {
      setResponseStyle(DEFAULT_RESPONSE_STYLE);
    }
  }, [styleStorageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, loading]);

  const sendMessage = useCallback(async (rawText: string, appendUserMessage = true) => {
    const text = rawText.trim();
    if (!text || loading) return;

    setInput("");
    if (appendUserMessage) {
      setMessages((current) => [...current, { role: "user", content: text }]);
    }
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ message: text, response_style: responseStyle }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        reply?: string;
        recommendation_id?: string;
        error?: string;
      };

      const succeeded = response.ok && Boolean(data.reply);
      setMessages((current) => [...current, {
        role: "assistant",
        content: succeeded && data.reply
          ? data.reply
          : data.error || "The assistant is unavailable right now. Please try again.",
        recommendationId: succeeded ? data.recommendation_id : null,
        retryPrompt: succeeded ? undefined : text,
      }]);
    } catch {
      setMessages((current) => [...current, {
        role: "assistant",
        content: "Network error. Please try again.",
        retryPrompt: text,
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading, responseStyle]);

  const send = useCallback(() => {
    void sendMessage(input);
  }, [input, sendMessage]);

  function updateResponseStyle(nextStyle: ResponseStyle) {
    setResponseStyle(nextStyle);
    try {
      window.localStorage.setItem(styleStorageKey, nextStyle);
    } catch {
      // The preference remains active for this session when browser storage is unavailable.
    }
  }

  function retryMessage(messageIndex: number, prompt: string) {
    if (loading) return;
    setMessages((current) => current.filter((_, index) => index !== messageIndex));
    void sendMessage(prompt, false);
  }

  async function openRecommendation(recommendationId: string) {
    setOpeningRecommendationId(recommendationId);
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as DashboardData | null;
      if (!response.ok || !data || !Array.isArray(data.recommendations)) {
        throw new Error("Could not load the latest recommendations.");
      }

      const recommendation = findRecommendationById(data.recommendations, recommendationId);
      if (!recommendation) {
        throw new Error("That recommendation is no longer available. Refresh the dashboard and try again.");
      }

      setSelectedAction(recommendationToActionPreview(recommendation));
      setSelectedMetrics(data.metrics);
      setOpen(false);
    } catch (error) {
      setMessages((current) => [...current, {
        role: "assistant",
        content: error instanceof Error ? error.message : "That recommendation is no longer available.",
      }]);
    } finally {
      setOpeningRecommendationId(null);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open assistant"
          className="absolute bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent-primary text-white shadow-2xl transition-transform hover:scale-105"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close assistant"
            className="absolute inset-0 cursor-default bg-black/30"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-surface shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-primary/10 text-accent-primary">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-bold text-foreground">{client.brand.logo.title} Copilot</p>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Campaign assistant</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-border/50 p-2 text-text-muted transition-colors hover:text-foreground"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className="border-b border-border/60 px-5 py-2.5"
              role="group"
              aria-label="Copilot response style"
            >
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-text-muted">
                Response style
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {RESPONSE_STYLE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateResponseStyle(option.value)}
                    aria-pressed={responseStyle === option.value}
                    className={cn(
                      "rounded-lg border px-1.5 py-1.5 text-[10px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40",
                      responseStyle === option.value
                        ? "border-accent-primary bg-accent-primary text-white"
                        : "border-border/60 bg-background text-text-muted hover:border-accent-primary hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
              {messages.map((message, index) => (
                <div key={index} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      message.role === "user"
                        ? "bg-accent-primary text-white"
                        : "border border-border/60 bg-background text-foreground",
                    )}
                  >
                    {message.role === "assistant" ? (
                      <AssistantMarkdown content={message.content} />
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                    {message.recommendationId && (
                      <button
                        type="button"
                        onClick={() => void openRecommendation(message.recommendationId!)}
                        disabled={openingRecommendationId === message.recommendationId}
                        className="mt-3 flex items-center gap-2 rounded-lg bg-accent-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                      >
                        {openingRecommendationId === message.recommendationId && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        Review proposed change
                      </button>
                    )}
                    {message.retryPrompt && (
                      <button
                        type="button"
                        onClick={() => retryMessage(index, message.retryPrompt!)}
                        disabled={loading}
                        className="mt-3 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground transition-colors hover:border-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40 disabled:opacity-60"
                      >
                        Try again
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!hasStartedConversation && (
                <div className="pt-1">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-text-muted">Try asking</p>
                  <div className="space-y-2">
                    {conversationStarters.map((starter) => (
                      <button
                        key={starter}
                        type="button"
                        onClick={() => void sendMessage(starter)}
                        disabled={loading}
                        className="w-full rounded-xl border border-border/60 bg-surface px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:border-accent-primary hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40 disabled:opacity-60"
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {loading && (
                <div className="flex justify-start" role="status">
                  <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background px-4 py-2.5 text-sm text-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" /> Checking your campaign data...
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border/60 px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onKeyDown}
                  maxLength={4_000}
                  rows={1}
                  placeholder="Ask about your ads..."
                  className="max-h-32 flex-1 resize-none rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={loading || !input.trim()}
                  aria-label="Send message"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-primary text-white transition-colors hover:bg-accent-primary/90 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      <ActionDrawer
        action={selectedAction}
        clientName={client.key}
        baselineMetrics={selectedMetrics}
        open={selectedAction !== null}
        onClose={() => setSelectedAction(null)}
        onApplied={() => setSelectedAction(null)}
        onManual={() => setSelectedAction(null)}
        onDismissed={() => setSelectedAction(null)}
      />
    </>
  );
}
