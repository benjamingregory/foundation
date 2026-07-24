#!/usr/bin/env tsx
/**
 * test-tenancy.mts — structural guard for the one invariant that keeps
 * users' data apart. Zero DB reads, zero LLM calls — safe for CI, and the
 * whole point is that it does NOT need a live database to run.
 *
 * Why a source-text scan instead of a behavioural test: the app connects to
 * Postgres as the `postgres` role, which has BYPASSRLS, so RLS policies on
 * user-scoped tables never evaluate in the request path (see CLAUDE.md
 * Development Pattern #5 — "RLS is not in the request path"). Tenancy rests
 * entirely on every repository query carrying `eq(table.userId, userId)`.
 * This script is what stops a future repository function from quietly
 * dropping that predicate.
 *
 * ── Function-boundary detection ────────────────────────────────────────
 * Every exported function in `db/repositories/*.ts` is analyzed, in either
 * shape:
 *
 *   export function listItems(userId: string) { ... }
 *   export async function listItems(userId: string) { ... }
 *   export const listItems = (userId: string) => { ... }
 *   export const listItems = async (userId: string) => { ... }
 *   export const listItems = function (userId: string) { ... }
 *
 * Boundaries are found with a small bracket-depth scanner (not `.split()`
 * on the next `export`, and not a full TS parser): it locates the
 * parameter list's matching `)`, then scans forward for the function's
 * `{ ... }` block (matching its own closing `}`) or, for a concise arrow
 * body with no braces, the expression up to the terminating `;`. The
 * scanner skips over string/template literals and comments so a stray
 * `{`/`}`/`(`/`)`/`;` inside one of those doesn't desync the depth count.
 *
 * ── "Does this function run a query" ────────────────────────────────────
 * Detected by Drizzle query-builder verbs appearing in the function body —
 * `.select(`, `.insert(`, `.update(`, `.delete(`, or `.from(` — NOT by the
 * `schema.` prefix. The old `schema.`-substring gate silently skipped any
 * function written against a directly-imported table constant (`import {
 * items } from "../schema/items"`), since `schema.` never appears in that
 * style. Verb detection covers both `schema.items` and direct imports
 * identically.
 *
 * ── Required userId scoping token ───────────────────────────────────────
 * A function whose body contains `.select(`/`.update(`/`.delete(`/`.from(`
 * MUST also contain a where-clause scoping token:
 *
 *   eq(<anything>.userId, userId)     — e.g. eq(schema.items.userId, userId)
 *   eq(userId, ...)                   — userId as the left-hand argument
 *
 * A function whose ONLY query verb is `.insert(` (no select/update/delete/
 * from) has no where-clause to scope in the first place, so instead the
 * row being written must carry `userId` inside its first `.values(...)`
 * call. (`userProfiles` is primary-keyed on `userId`, so `ensureUserProfile`
 * is exactly this shape.)
 *
 * A query-running function with NEITHER token anywhere → FAIL LOUD, naming
 * the file and function.
 *
 * ── Allowlisting a deliberate cross-tenant function ─────────────────────
 * Two mechanisms, both greppable and both require a reason (there are no
 * entries today; Tasks 10/11 — inngestRuns cron fan-out, billing/Stripe
 * webhooks keyed by customer id — may need one):
 *
 *   1. `CROSS_TENANT_OK["file.ts#functionName"] = "reason"` below.
 *   2. An inline comment anywhere in the function's own text (or in a
 *      comment block directly above its `export` line):
 *        // tenancy-check: cross-tenant-ok <reason>
 *
 * ── Residual limitations (regex/bracket-depth, not a full AST) ──────────
 * - Multi-query functions are checked for at least one scoping token
 *   appearing SOMEWHERE in the function body (or in the first `.values(`
 *   call), not independently per query call. A function with two select
 *   statements — one correctly scoped, one not — will still pass, because
 *   the unscoped one sits in the same body as the scoped one's `eq(...)`
 *   text. Per-call-chain windowing was considered and rejected: splitting
 *   a body into "the text between one query call and the next" produces
 *   false FAILS on the equally-legitimate pattern of building a where
 *   clause in a local variable before the query (`const scope = eq(...);
 *   ... .where(scope)`), since that `eq(...)` would fall outside every
 *   window. A false FAIL that blocks CI on correct code is worse than a
 *   narrow false PASS on a same-function double-query anti-pattern that
 *   code review is likely to catch anyway — so this stays a documented
 *   gap rather than a "fix" that trades one blind spot for another.
 *   Same caveat applies to a function with two separate `.insert(...)
 *   .values(...)` calls: only the first `.values(...)` block is checked.
 * - Raw `sql\`...\`` tagged-template queries carry none of the five verbs
 *   this script looks for, so a repository function written entirely as a
 *   raw SQL string (none exist today) would not be classified as a query
 *   at all and would silently pass. Add a verb (or a dedicated check) if
 *   that shape is ever introduced.
 * - Generic type parameters between a function name and its parameter
 *   list (`export function foo<T>(...)`) are tolerated in the regexes but
 *   not exhaustively tested; an unusual generic shape could in principle
 *   confuse boundary detection.
 *
 *   npx tsx scripts/test-tenancy.mts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

function walk(rel: string, match: (f: string) => boolean): string[] {
  const abs = path.join(ROOT, rel);
  const out: string[] = [];
  for (const entry of readdirSync(abs)) {
    const child = path.join(abs, entry);
    const childRel = path.join(rel, entry);
    if (statSync(child).isDirectory()) out.push(...walk(childRel, match));
    else if (match(entry)) out.push(childRel);
  }
  return out;
}

console.log("db/repositories · every exported query is userId-scoped\n");

/**
 * Functions that deliberately span tenants: crons, webhooks, and reads
 * against global (non-user-scoped) tables. Every entry needs a reason — a
 * bare id here would be a silent hole; a documented one is a reviewed
 * decision. Key shape is `<file basename>#<exported function name>`.
 * Example shape for a future entry:
 *   "billing.ts#getBillingByCustomerId": "Stripe webhook, keyed on customer id",
 */
const CROSS_TENANT_OK: Record<string, string> = {};

/** Repository files whose table is global rather than user-scoped — every
 *  exported function in the file is skipped. Prefer the per-function
 *  CROSS_TENANT_OK / inline-marker mechanisms unless the whole file is
 *  global. */
const GLOBAL_TABLE_FILES = new Set<string>([]);

const repoFiles = walk("db/repositories", (f) => f.endsWith(".ts")).filter(
  (rel) => !path.basename(rel).startsWith("_"),
);
check(
  "found the repository files to scan",
  repoFiles.length > 0,
  `found ${repoFiles.length}`,
);

// `eq(<anything>.userId, userId)` — the shape every scoped read/write/delete
// carries — OR `eq(userId, ...)` with userId as the left-hand argument.
// `[^,]*` is greedy but backtracks to let the trailing `.userId` literal
// match, so it works across `schema.items.userId`, `t.userId`, etc., and
// across newlines (`\s` matches them) inside `and(...)` wrappers.
const USERID_SCOPE =
  /eq\(\s*[^,]*\.userId\s*,\s*userId\s*\)|eq\(\s*userId\s*,/;

// Any of these appearing in a function body means it runs a query — the
// shape is agnostic to how the table got there (`schema.items` off
// `activeDb()`, or a directly-imported `items` constant both call
// `.select()`/`.from()`/etc. identically).
const QUERY_VERB = /\.\s*(select|update|delete|from)\s*\(/;
const INSERT_VERB = /\.\s*insert\s*\(/;

const MARKER_RE = /tenancy-check:\s*cross-tenant-ok\b\s*(.*)/;

const OPEN = "([{";
const CLOSE = ")]}";

/** Advances past a string/template literal starting at `src[start]` (which
 *  must be a quote char), returning the index of the closing quote (or
 *  `src.length` if unterminated). Used by both the bracket matcher and the
 *  body-boundary scanner so a `{`/`}`/`(`/`)`/`;` inside a string never
 *  desyncs them. */
function skipString(src: string, start: number): number {
  const quote = src[start];
  let i = start + 1;
  while (i < src.length && src[i] !== quote) {
    if (src[i] === "\\") i++;
    i++;
  }
  return i;
}

/** Given the index of an opening `(`/`[`/`{`, returns the index of its
 *  matching close, skipping over string/template literals and comments so
 *  bracket-shaped characters inside them don't count. Returns -1 if the
 *  source is unbalanced/unparsable from this point (caller should bail
 *  rather than loop forever). */
function findMatchingClose(src: string, openIdx: number): number {
  const stack: string[] = [CLOSE[OPEN.indexOf(src[openIdx])]];
  let i = openIdx + 1;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i);
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i++;
      continue;
    }
    if (OPEN.includes(c)) {
      stack.push(CLOSE[OPEN.indexOf(c)]);
    } else if (CLOSE.includes(c)) {
      if (stack[stack.length - 1] === c) {
        stack.pop();
        if (stack.length === 0) return i;
      } else {
        return -1; // unbalanced relative to what we expected — bail
      }
    }
  }
  return -1;
}

type ExportedFn = {
  name: string;
  body: string;
  declStart: number;
  precedingStart: number;
};

// Three shapes an exported repository function can take. Each pattern's
// capture group is the function name, and each match ends right at (and
// including) the parameter list's opening `(`.
const FN_START_PATTERNS = [
  /^\s*export\s+(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(/gm,
  /^\s*export\s+const\s+(\w+)\s*(?::\s*[^=\n]+)?=\s*(?:async\s+)?(?:<[^>]*>\s*)?\(/gm,
  /^\s*export\s+const\s+(\w+)\s*(?::\s*[^=\n]+)?=\s*(?:async\s+)?function\s*\(/gm,
];

function extractExportedFunctions(src: string): ExportedFn[] {
  const raw: { name: string; matchStart: number; parenOpen: number }[] = [];
  for (const re of FN_START_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      raw.push({
        name: m[1],
        matchStart: m.index,
        parenOpen: m.index + m[0].length - 1,
      });
    }
  }
  raw.sort((a, b) => a.matchStart - b.matchStart);

  const out: ExportedFn[] = [];
  for (const { name, matchStart, parenOpen } of raw) {
    const parenClose = findMatchingClose(src, parenOpen);
    if (parenClose === -1) continue; // malformed / unparsable — skip, don't crash

    // Scan forward from just past the parameter list for the function
    // body: either a `{ ... }` block, or (for a concise arrow) an
    // expression terminated by `;` / end of file. Return-type annotations
    // and `=>` in between are skipped over char-by-char rather than
    // matched, so this doesn't need to understand TS type syntax.
    let i = parenClose + 1;
    let bodyStart = -1;
    let sawBrace = false;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '"' || c === "'" || c === "`") {
        i = skipString(src, i);
        continue;
      }
      if (c === "/" && src[i + 1] === "/") {
        while (i < src.length && src[i] !== "\n") i++;
        continue;
      }
      if (c === "/" && src[i + 1] === "*") {
        i += 2;
        while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
        i++;
        continue;
      }
      if (c === "{") {
        bodyStart = i;
        sawBrace = true;
        break;
      }
      if (c === ";") break; // concise-body arrow, no braces
    }

    let body: string;
    if (sawBrace) {
      const bodyEnd = findMatchingClose(src, bodyStart);
      body = bodyEnd === -1 ? src.slice(bodyStart) : src.slice(bodyStart + 1, bodyEnd);
    } else {
      body = src.slice(parenClose + 1, i);
    }

    out.push({
      name,
      body,
      declStart: matchStart,
      precedingStart: Math.max(0, matchStart - 300),
    });
  }
  return out;
}

/** First `.values(...)` call's content, bracket-matched (not a fixed-width
 *  window) — or `null` if the function has no `.values(` call at all. */
function extractFirstValuesBlock(body: string): string | null {
  const m = /\.\s*values\s*\(/.exec(body);
  if (!m) return null;
  const openIdx = m.index + m[0].length - 1;
  const closeIdx = findMatchingClose(body, openIdx);
  if (closeIdx === -1) return body.slice(openIdx + 1);
  return body.slice(openIdx + 1, closeIdx);
}

/** Looks for `// tenancy-check: cross-tenant-ok <reason>` either directly
 *  above the function's `export` line or anywhere inside its own text. */
function findAllowlistMarker(src: string, fn: ExportedFn): string | null {
  const window =
    src.slice(fn.precedingStart, fn.declStart) + "\n" + fn.body;
  const m = MARKER_RE.exec(window);
  return m ? m[1].trim() || "(no reason given)" : null;
}

type Offender = { name: string; file: string; reason: string };
const unscoped: Offender[] = [];
const allowlisted: string[] = [];

for (const rel of repoFiles) {
  const base = path.basename(rel);
  if (GLOBAL_TABLE_FILES.has(base)) continue;
  const src = read(rel);

  for (const fn of extractExportedFunctions(src)) {
    const key = `${base}#${fn.name}`;

    if (key in CROSS_TENANT_OK) {
      allowlisted.push(`${key} (${CROSS_TENANT_OK[key]})`);
      continue;
    }
    const marker = findAllowlistMarker(src, fn);
    if (marker) {
      allowlisted.push(`${key} (${marker})`);
      continue;
    }

    const hasQueryVerb = QUERY_VERB.test(fn.body);
    const hasInsert = INSERT_VERB.test(fn.body);
    if (!hasQueryVerb && !hasInsert) continue; // pure helper, not a query

    if (hasQueryVerb) {
      if (USERID_SCOPE.test(fn.body)) continue;
      unscoped.push({
        name: key,
        file: rel,
        reason:
          "runs a select/update/delete/from query with no eq(<table>.userId, userId) / eq(userId, ...) scoping token anywhere in the function body",
      });
      continue;
    }

    // Insert-only: no where-clause to scope, so the row being written
    // must carry userId in its .values(...) call instead.
    const valuesContent = extractFirstValuesBlock(fn.body);
    if (valuesContent !== null && /\buserId\b/.test(valuesContent)) continue;
    unscoped.push({
      name: key,
      file: rel,
      reason: "insert-only function has no userId inside its .values(...) call",
    });
  }
}

check(
  "every exported repository query is userId-scoped, or is a declared cross-tenant function",
  unscoped.length === 0,
  unscoped.map((o) => `${o.name} (${o.file}): ${o.reason}`).join("; "),
);

if (allowlisted.length > 0) {
  console.log("\n  Allowlisted cross-tenant functions (reviewed exceptions):");
  for (const entry of allowlisted) console.log(`    ⚠️  ${entry}`);
}

const staleCrossTenant = Object.keys(CROSS_TENANT_OK).filter((key) => {
  const [base, fnName] = key.split("#");
  const rel = repoFiles.find((r) => path.basename(r) === base);
  if (!rel) return true;
  return !extractExportedFunctions(read(rel)).some((fn) => fn.name === fnName);
});
check(
  "no stale entries in the cross-tenant allowlist",
  staleCrossTenant.length === 0,
  staleCrossTenant.join(", "),
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
