import { handleChatStream } from "@mastra/ai-sdk";
import type { ChatStreamHandlerParams } from "@mastra/ai-sdk";
import { RequestContext } from "@mastra/core/request-context";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import { withAuth } from "@/lib/api/with-auth";
import { getMastra } from "@/lib/mastra/config";

export const maxDuration = 300;

/**
 * `handleChatStream` is overloaded on the AI SDK UI-message version: the v6
 * overload requires an explicit `version: "v6"`, so a call without one — like
 * this route's — resolves to the v5 overload and streams v5 chunks. Neither
 * message type is exported from `@mastra/ai-sdk`, so they are recovered here
 * from the handler's own public types:
 *
 *   `ChatStreamHandlerParams["messages"]` is the supported union (v5 | v6), and
 *   `Parameters<typeof handleChatStream>[0]` resolves to the last overload (v6),
 *   so excluding the latter from the former leaves exactly the v5 message type.
 *
 * Ported from jobflow's app/api/agents/chat/route.ts.
 */
type MastraV6Message =
  Parameters<typeof handleChatStream>[0]["params"]["messages"][number];
type MastraV5Message = Exclude<
  ChatStreamHandlerParams["messages"][number],
  MastraV6Message
>;

/**
 * `role` is the security-relevant field here — a caller must not be able to
 * post a `role: "system"` message and prepend an operator instruction to the
 * agent. The rest of the UI-message shape is passed through as-is, since
 * Mastra owns it and it varies by AI SDK version.
 */
const ChatMessageSchema = z.looseObject({
  role: z.enum(["user", "assistant"]),
});

const ChatSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(100),
  threadId: z.string().min(1).max(200).optional(),
});

export const POST = withAuth(
  {
    name: "chat",
    body: ChatSchema,
    // Chat is the most expensive thing a user can hold open — bucketed with
    // writes rather than the cheap default reads bucket.
    limit: "write",
  },
  async ({ userId, body }) => {
    // The trusted identity for every tool call this turn: set here from the
    // authenticated session, never read back out of the request body. See
    // lib/mastra/tools/_shared/createScopedTool.ts.
    const ctx = new RequestContext([["userId", userId]]);
    const threadId = body.threadId || `${userId}_${Date.now()}`;
    // Validated above; Mastra's message type is structural and varies by AI
    // SDK version, so the schema guards the security-relevant field (role)
    // and the shape is handed back to Mastra as it expects it.
    const messages = body.messages as unknown as MastraV5Message[];

    const uiStream = createUIMessageStream({
      execute: async ({ writer }) => {
        const mastraStream = await handleChatStream({
          mastra: getMastra(),
          agentId: "assistant",
          params: {
            messages,
            memory: {
              thread: threadId,
              resource: userId,
            },
            requestContext: ctx,
          },
        });
        // Mastra bundles its own copy of the AI SDK UI-message types, so its
        // stream is structurally identical to, but nominally distinct from,
        // the one `writer.merge` expects. Bridge it precisely instead of
        // with `any`.
        writer.merge(
          mastraStream as unknown as Parameters<typeof writer.merge>[0],
        );
      },
    });

    return createUIMessageStreamResponse({ stream: uiStream });
  },
);
