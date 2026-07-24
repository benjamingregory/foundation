import { eq } from "drizzle-orm";
import { activeDb } from "./_shared";
import type { UserProfile } from "../schema/users";

export type { UserProfile } from "../schema/users";

/**
 * Insert the user's profile row if one doesn't already exist yet.
 *
 * `userProfiles` is primary-keyed on `userId`, so this insert can only ever
 * create a row for the caller's own id — there's no separate where-clause to
 * carry a tenancy predicate because there's nothing else it could touch.
 *
 * Returns whether a row was just created. Task 9/10 fire the
 * `"user/signed-up"` event exactly once, gated on `created: true`, so a
 * second call for the same user (every subsequent sign-in) is a silent
 * no-op rather than a duplicate event.
 */
export async function ensureUserProfile(
  userId: string,
  email: string,
): Promise<{ created: boolean }> {
  const { db, schema } = activeDb();
  const inserted = await db
    .insert(schema.userProfiles)
    .values({ userId, email })
    .onConflictDoNothing({ target: schema.userProfiles.userId })
    .returning({ userId: schema.userProfiles.userId });
  return { created: inserted.length > 0 };
}

export async function getUserProfile(
  userId: string,
): Promise<UserProfile | null> {
  const { db, schema } = activeDb();
  const rows = await db
    .select()
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}
