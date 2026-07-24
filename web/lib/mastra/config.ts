import "server-only";
import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";
import { assistantAgent } from "./agents/assistant";

let _mastra: Mastra | null = null;

/**
 * Mastra singleton.
 *
 * Storage: Supabase Postgres via @mastra/pg, using the same DATABASE_URL as
 *   the Drizzle tables. Mastra creates its own `mastra_*` tables in that
 *   schema; they coexist with the Drizzle tables and do not interfere.
 *
 * Logger: Mastra's default (ConsoleLogger). Swap in `@mastra/loggers`'
 *   PinoLogger later if structured JSON logging is needed — it isn't a
 *   dependency of this skeleton yet.
 *
 * Registry: trimmed to a single agent (`assistant`). Add more agents /
 *   workflows / scorers here as the app grows.
 *
 * IMPORTANT: this must stay lazy — called per-request from route handlers,
 * never at module top-level — so `pnpm build` doesn't need DATABASE_URL set.
 */
export function getMastra(): Mastra {
  if (_mastra) return _mastra;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL not set; cannot initialize Mastra storage");
  }

  _mastra = new Mastra({
    agents: {
      assistant: assistantAgent,
    },
    storage: new PostgresStore({
      id: "foundation-storage",
      connectionString: url,
    }),
  });
  return _mastra;
}
