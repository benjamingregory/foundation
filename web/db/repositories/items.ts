import { and, eq } from "drizzle-orm";
import { activeDb, nowIso } from "./_shared";
import type { Item, ItemStatus } from "../schema/items";

export type { Item } from "../schema/items";

export async function listItems(userId: string): Promise<Item[]> {
  const { db, schema } = activeDb();
  return db
    .select()
    .from(schema.items)
    .where(eq(schema.items.userId, userId))
    .orderBy(schema.items.createdAt);
}

export type NewItemInput = {
  title: string;
  notes?: string | null;
};

export async function createItem(
  userId: string,
  input: NewItemInput,
): Promise<Item> {
  const { db, schema } = activeDb();
  const [item] = await db
    .insert(schema.items)
    .values({
      userId,
      title: input.title,
      notes: input.notes ?? null,
    })
    .returning();
  if (!item) throw new Error("insert into items returned no row");
  return item;
}

export type ItemPatch = Partial<{
  title: string;
  notes: string | null;
  status: ItemStatus;
}>;

/**
 * Returns the updated row, or `null` if no row matched — either the id
 * doesn't exist, or it belongs to a different user. The two cases are
 * deliberately indistinguishable from here on out: the `and(eq(id), eq
 * (userId))` predicate is what makes cross-tenant writes structurally
 * impossible rather than merely checked after the fact.
 */
export async function updateItem(
  userId: string,
  id: string,
  patch: ItemPatch,
): Promise<Item | null> {
  const { db, schema } = activeDb();
  const rows = await db
    .update(schema.items)
    .set({ ...patch, updatedAt: nowIso() })
    .where(and(eq(schema.items.id, id), eq(schema.items.userId, userId)))
    .returning();
  return rows[0] ?? null;
}

/** Returns `true` if a row was deleted (`false` if missing, or owned by
 *  another user). */
export async function deleteItem(userId: string, id: string): Promise<boolean> {
  const { db, schema } = activeDb();
  const rows = await db
    .delete(schema.items)
    .where(and(eq(schema.items.id, id), eq(schema.items.userId, userId)))
    .returning({ id: schema.items.id });
  return rows.length > 0;
}
