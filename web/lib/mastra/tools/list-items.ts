import "server-only";
import { z } from "zod";
import { createScopedTool } from "./_shared/createScopedTool";
import { listItems as repoListItems } from "@/db/repositories/items";
import { ITEM_STATUSES, type ItemStatus } from "@/db/schema/items";

/**
 * Proves the scoped-tool pattern end to end: the model can never supply
 * `userId` — it comes from the trusted RequestContext set by the chat route
 * (see app/api/chat/route.ts) and is threaded through by createScopedTool.
 */
export const listItemsTool = createScopedTool({
  id: "list_items",
  description: "List the user's items, optionally filtered by status.",
  inputSchema: z.object({
    status: z
      .enum(ITEM_STATUSES)
      .optional()
      .describe("Optional status to filter by (open or done)."),
  }),
  outputSchema: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        notes: z.string().nullable(),
        status: z.enum(ITEM_STATUSES),
        createdAt: z.string(),
      }),
    ),
  }),
  execute: async (input, { userId }) => {
    const rows = await repoListItems(userId);
    const filtered = input.status
      ? rows.filter((r) => r.status === input.status)
      : rows;
    return {
      items: filtered.map((r) => ({
        id: r.id,
        title: r.title,
        notes: r.notes,
        // The DB column is a bare `text` with a CHECK constraint (see
        // db/schema/items.ts), so Drizzle infers `string`, not the literal
        // union — the CHECK is what actually guarantees this narrowing.
        status: r.status as ItemStatus,
        createdAt: r.createdAt,
      })),
    };
  },
});
