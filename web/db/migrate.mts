import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }
  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    throw new Error(
      "foundation is Postgres-only. DATABASE_URL must start with postgres:// or postgresql://.",
    );
  }
  console.log(`foundation migrations → pg (${url.replace(/:[^@]+@/, ":***@")})`);

  const sql = postgres(url, { prepare: false, max: 1 });
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  const applied = new Set(
    (await sql<{ name: string }[]>`SELECT name FROM _migrations`).map(
      (r) => r.name,
    ),
  );
  const dir = join(__dirname, "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    if (applied.has(f)) {
      console.log(`  ✓ ${f} (already applied)`);
      continue;
    }
    const body = readFileSync(join(dir, f), "utf8");
    console.log(`  → applying ${f}`);
    await sql.unsafe(body);
    await sql`INSERT INTO _migrations (name) VALUES (${f})`;
  }
  await sql.end();
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
