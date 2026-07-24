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
// 5-connection pool per reload until the Postgres pooler hits its cap.
//
// Only the POOL is the leak hazard, so only the pool is cached
// unconditionally. The drizzle wrapper and the schema must track the CURRENT
// schema module: caching them alongside the pool pinned a stale schema after
// every migration — a repo touching a table added since the server started
// would throw "Cannot read properties of undefined" until a full dev-server
// restart. Rebuilding the wrapper is allocation-only (no I/O), and the
// `cached.schema === schema` identity check makes it a no-op outside HMR.
const globalForDb = globalThis as unknown as {
  __foundationSql?: ReturnType<typeof postgres>;
  __foundationDb?: DbHandle;
};

export function getDb(): DbHandle {
  const cached = globalForDb.__foundationDb;
  if (cached && cached.schema === schema) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. foundation requires a Postgres connection string.",
    );
  }
  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    throw new Error(
      "foundation is Postgres-only. DATABASE_URL must start with postgres:// or postgresql://.",
    );
  }

  const sql = globalForDb.__foundationSql ?? postgres(url, { prepare: false, max: 5 });
  globalForDb.__foundationSql = sql;
  const db = drizzle(sql, { schema });
  globalForDb.__foundationDb = { db, schema };
  return globalForDb.__foundationDb;
}
