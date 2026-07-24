import { desc, eq } from "drizzle-orm";
import { activeDb } from "./_shared";
import type { InngestRun } from "../schema/inngest-runs";

export type { InngestRun } from "../schema/inngest-runs";

const DEFAULT_LIMIT = 20;

/**
 * The current user's recent background-job runs, newest first — read by
 * `GET /api/jobs` for the jobs dock (components/jobs/jobs-dock.tsx).
 *
 * Writes to `inngest_runs` are system-level (the RunLedgerMiddleware in
 * lib/inngest/run-ledger.ts writes whichever `userId` an event payload
 * names, not whoever issued the current request) and deliberately live
 * outside this directory — see that file's doc comment for why. This read
 * is the only inngest-runs code in `db/repositories/`.
 */
export async function listRunsForUser(
  userId: string,
  limit = DEFAULT_LIMIT,
): Promise<InngestRun[]> {
  const { db, schema } = activeDb();
  return db
    .select()
    .from(schema.inngestRuns)
    .where(eq(schema.inngestRuns.userId, userId))
    .orderBy(desc(schema.inngestRuns.updatedAt))
    .limit(limit);
}
