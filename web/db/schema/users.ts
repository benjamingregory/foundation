/**
 * User profile — one row per authenticated user, keyed on Supabase
 * `auth.users.id`. Created by `ensureUserProfile` the first time a signed-in
 * user is seen; nothing else writes it in this skeleton.
 *
 * Part of the schema barrel — see ./index.ts.
 */
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
