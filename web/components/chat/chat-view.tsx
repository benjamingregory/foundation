"use client";

import { useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { duration, ease } from "@/lib/motion";

/**
 * Minimal chat UI over `POST /api/chat` (see app/api/chat/route.ts). Auth
 * rides on the same-origin Supabase session cookie — no token handling here.
 */
export function ChatView() {
  const prefersReducedMotion = useReducedMotion();
  const [input, setInput] = useState("");
  const [transport] = useState(
    () => new DefaultChatTransport({ api: "/api/chat" }),
  );
  const { messages, sendMessage, status, error } = useChat({ transport });

  const busy = status === "submitted" || status === "streaming";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ role: "user", parts: [{ type: "text", text }] });
    setInput("");
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-2xl flex-col px-4">
      <div className="flex-1 overflow-y-auto py-6">
        {messages.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="Ask about your items"
            description={'Try "what items do I have?" — the assistant answers from your data.'}
          />
        ) : (
          <ul className="space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.li
                  key={message.id}
                  layout
                  initial={
                    prefersReducedMotion ? false : { opacity: 0, y: 6 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: duration.fast, ease: ease.out }}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {message.parts.map((part, i) => {
                      if (part.type === "text") {
                        return (
                          <p key={i} className="whitespace-pre-wrap">
                            {part.text}
                          </p>
                        );
                      }
                      if (
                        part.type === "dynamic-tool" ||
                        part.type.startsWith("tool-")
                      ) {
                        const toolPart = part as {
                          type: string;
                          state?: string;
                          toolName?: string;
                        };
                        const name =
                          toolPart.toolName ??
                          toolPart.type.replace(/^tool-/, "");
                        return (
                          <p
                            key={i}
                            className="text-xs text-muted-foreground italic"
                          >
                            {toolPart.state === "output-available"
                              ? `Checked ${name.replace(/_/g, " ")}`
                              : `Checking ${name.replace(/_/g, " ")}…`}
                          </p>
                        );
                      }
                      return null;
                    })}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
            {status === "submitted" && (
              <li className="flex justify-start">
                <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Thinking…
                </div>
              </li>
            )}
          </ul>
        )}
        {error && (
          <p className="mt-2 text-xs text-destructive">
            {error.message || "Something went wrong. Try again."}
          </p>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border py-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your items…"
          disabled={busy}
          aria-label="Message"
        />
        <Button
          type="submit"
          size="icon"
          disabled={busy || !input.trim()}
          aria-label="Send message"
        >
          <ArrowUp />
        </Button>
      </form>
    </div>
  );
}
