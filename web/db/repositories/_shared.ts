import { getDb } from "../client";

/** The current db handle + schema module, in the shape every repository
 *  function destructures: `const { db, schema } = activeDb();` */
export function activeDb() {
  const handle = getDb();
  return {
    db: handle.db,
    schema: handle.schema,
  };
}

export function nowIso(): string {
  return new Date().toISOString();
}
