/**
 * Guards db/schema.ts — a hand-maintained COPY of three tables from the
 * product app's schema — against its source of truth.
 *
 * admin/ is a separate pnpm root with its own lockfile; it cannot import
 * web/db/schema at runtime (each app bundles independently). This script
 * instead reads web/db/schema/index.ts as a plain TypeScript module — not
 * the live database — and diffs the column set of each copied table against
 * admin's copy. A column renamed or dropped in web compiles fine in
 * db/schema.ts and fails silently at runtime; this catches it ahead of that.
 *
 * Only checked one direction: every column admin declares must still exist
 * in web. A new web column admin doesn't mirror is not drift — admin only
 * ever reads what it declares. Table/column identity is compared by name;
 * this does not check Postgres column types.
 *
 *   pnpm check:drift
 */
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import * as adminSchema from "../db/schema.ts";
import * as webSchema from "../../web/db/schema/index.ts";

/** Keys exported from both db/schema.ts and web/db/schema/index.ts. */
const COPIED_TABLES = ["userProfiles", "userBilling", "inngestRuns"] as const;

type Diff = { table: string; detail: string };

/**
 * Look up a named export, tolerating either shape a tsx-loaded module can
 * come back as. This file is `.mts` (unconditionally ESM); whether a `.ts`
 * sibling it imports comes back with named exports hoisted to the top level
 * or nested under `.default` depends on that file's own package's module
 * format (its `package.json` "type" field) and tsx's CJS/ESM interop for
 * it — something this script doesn't control and shouldn't have to know,
 * especially for the cross-package `web/db/schema` import. Observed in
 * practice: `admin/db/schema.ts` resolves with top-level named exports,
 * `web/db/schema/index.ts` resolves nested under `.default`. Check both.
 */
function resolveExport(mod: Record<string, unknown>, key: string): unknown {
  if (key in mod) return mod[key];
  const def = mod.default;
  if (def && typeof def === "object" && key in (def as object)) {
    return (def as Record<string, unknown>)[key];
  }
  return undefined;
}

function isPgTable(value: unknown): value is PgTable {
  if (typeof value !== "object" || value === null) return false;
  try {
    getTableConfig(value as PgTable);
    return true;
  } catch {
    return false;
  }
}

function columnNames(table: PgTable): Set<string> {
  return new Set(getTableConfig(table).columns.map((c) => c.name));
}

function main() {
  const diffs: Diff[] = [];
  let columnsChecked = 0;

  for (const key of COPIED_TABLES) {
    const adminTable = resolveExport(adminSchema as Record<string, unknown>, key);
    const webTable = resolveExport(webSchema as Record<string, unknown>, key);

    if (!isPgTable(adminTable)) {
      diffs.push({ table: key, detail: `admin/db/schema.ts does not export a table named "${key}"` });
      continue;
    }
    if (!isPgTable(webTable)) {
      diffs.push({
        table: key,
        detail: `web/db/schema does not export "${key}" — renamed or removed upstream`,
      });
      continue;
    }

    const adminName = getTableConfig(adminTable).name;
    const webName = getTableConfig(webTable).name;
    if (adminName !== webName) {
      diffs.push({
        table: key,
        detail: `table name "${adminName}" (admin) vs "${webName}" (web)`,
      });
      continue;
    }

    const adminCols = columnNames(adminTable);
    const webCols = columnNames(webTable);

    for (const col of adminCols) {
      columnsChecked += 1;
      if (!webCols.has(col)) {
        diffs.push({
          table: webName,
          detail: `column "${col}" is declared in admin/db/schema.ts but no longer exists on web's ${webName}`,
        });
      }
    }
  }

  if (diffs.length > 0) {
    console.error("Schema drift detected — admin/db/schema.ts is out of sync with web/db/schema:\n");
    for (const d of diffs) {
      console.error(`  ${d.table}: ${d.detail}`);
    }
    console.error(
      "\nReconcile admin/db/schema.ts against web/db/schema/*.ts, then re-run `pnpm check:drift`.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `No drift. Verified ${COPIED_TABLES.length} tables / ${columnsChecked} columns against web/db/schema.`,
  );
}

main();
