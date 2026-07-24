import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { wrapLanguageModel } from "ai";
import { toolInputSanitizerMiddleware } from "./middleware/tool-input-sanitizer";

/**
 * Anthropic model factory. ANTHROPIC_API_KEY is read automatically from env
 * by @ai-sdk/anthropic. Override the chat model id via env:
 *   CHAT_MODEL  (default: claude-haiku-4-5)
 */

const DEFAULT_CHAT_MODEL = "claude-haiku-4-5";

function wrap(modelId: string) {
  return wrapLanguageModel({
    model: anthropic(modelId),
    middleware: [toolInputSanitizerMiddleware],
  });
}

/** Resolved chat model id — use this wherever the id is recorded (token
 *  usage rows), so an env override doesn't silently misattribute cost. */
export function chatModelId(): string {
  return process.env.CHAT_MODEL ?? DEFAULT_CHAT_MODEL;
}

export function chatModel() {
  return wrap(chatModelId());
}
