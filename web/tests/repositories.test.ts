import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { nowIso } from "@/db/repositories/_shared";

describe("db/repositories/_shared", () => {
  it("nowIso returns an ISO-8601 timestamp string", () => {
    const iso = nowIso();
    expect(typeof iso).toBe("string");
    expect(new Date(iso).toISOString()).toBe(iso);
  });
});

// The repository functions below call `getDb()`, which throws if
// DATABASE_URL is unset — importing them at module scope would make this
// whole file fail to load in an environment with no database configured.
// Dynamic-import them only inside a skipped-when-no-DB suite so `pnpm test`
// always passes without a live Postgres connection.
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("db/repositories (live DB integration)", () => {
  it("ensureUserProfile returns { created: boolean } and is idempotent", async () => {
    const { ensureUserProfile } = await import("@/db/repositories/userProfiles");
    const userId = randomUUID();
    const email = `test-${userId}@example.com`;

    const first = await ensureUserProfile(userId, email);
    expect(first).toEqual({ created: true });

    const second = await ensureUserProfile(userId, email);
    expect(second).toEqual({ created: false });
  });

  it("createItem returns the created item's shape, scoped to its owner", async () => {
    const { ensureUserProfile } = await import("@/db/repositories/userProfiles");
    const { createItem, deleteItem } = await import("@/db/repositories/items");
    const userId = randomUUID();
    await ensureUserProfile(userId, `test-${userId}@example.com`);

    const item = await createItem(userId, { title: "Write the report" });
    try {
      expect(item).toMatchObject({
        userId,
        title: "Write the report",
        notes: null,
        status: "open",
      });
      expect(typeof item.id).toBe("string");
      expect(typeof item.createdAt).toBe("string");
    } finally {
      await deleteItem(userId, item.id);
    }
  });
});
