/**
 * Schema barrel. `drizzle.config.ts` (schema: "./db/schema/index.ts") and
 * every `import * as schema from "@/db/schema"` resolve through this file.
 *
 * Adding a table: put it in the domain module it belongs to, then re-export
 * it here — not the other way around.
 */
export * from "./users";
export * from "./items";
export * from "./billing";
export * from "./inngest-runs";
