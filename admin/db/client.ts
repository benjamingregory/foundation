import "dotenv/config";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DbHandle = {
  db: PostgresJsDatabase<typeof schema>;
  schema: typeof schema;
};

// Cache on globalThis, not module scope: under `next dev`, HMR re-instantiates
// this module on every invalidation, and a module-level cache leaks a fresh
// connection pool per reload until the Postgres pooler hits its cap. Mirrors
// web/db/client.ts.
const globalForDb = globalThis as unknown as {
  __adminSql?: ReturnType<typeof postgres>;
  __adminDb?: DbHandle;
};

/**
 * DATABASE_URL points at the same Postgres as the product app, connected as
 * the `postgres` role — which has BYPASSRLS, so nothing in Postgres scopes
 * these reads. This app is read-only by convention (no writes anywhere in
 * admin/); the ADMIN_EMAIL_DOMAIN gate in proxy.ts + requireAdmin() is the
 * only thing standing between the public internet and every user's data.
 * See lib/auth-config.ts.
 *
 * Called only from inside a page's request handler, never at module scope —
 * so a build with no DATABASE_URL set never reaches the throw below.
 */
export function getDb(): DbHandle {
  const cached = globalForDb.__adminDb;
  if (cached && cached.schema === schema) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }

  const sql = globalForDb.__adminSql ?? postgres(url, { prepare: false, max: 3 });
  globalForDb.__adminSql = sql;
  const db = drizzle(sql, { schema });
  globalForDb.__adminDb = { db, schema };
  return globalForDb.__adminDb;
}
