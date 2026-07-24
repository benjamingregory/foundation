/**
 * `items` — the one user-scoped resource this skeleton demonstrates end to
 * end (repository -> API route -> TanStack Query dashboard). Copy the
 * pattern for real domain tables.
 *
 * Part of the schema barrel — see ./index.ts.
 */
import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, index, check } from "drizzle-orm/pg-core";

export const ITEM_STATUSES = ["open", "done"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    notes: text("notes"),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("items_user_id_idx").on(t.userId),
    check("items_status_check", sql`${t.status} IN ('open','done')`),
  ],
);

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
