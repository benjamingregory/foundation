import "server-only";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { chatModel } from "../models";
import { STATIC_ASSISTANT_PROMPT } from "../prompts/assistant-static";
import { listItemsTool } from "../tools/list-items";

/**
 * The single agent this skeleton registers. Instructions are a static system
 * message marked cacheControl: ephemeral (Anthropic prompt caching, per
 * CLAUDE.md's convention — every static system prompt gets this) via the
 * provider options jobflow's chat agent uses.
 */
export const assistantAgent = new Agent({
  id: "assistant",
  name: "foundation assistant",
  description: "Conversational agent over the user's items.",
  model: chatModel(),
  instructions: [
    {
      role: "system",
      content: STATIC_ASSISTANT_PROMPT,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    },
  ],
  tools: {
    list_items: listItemsTool,
  },
  memory: new Memory({
    options: {
      lastMessages: 30,
    },
  }),
});
