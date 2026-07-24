/**
 * Who may use the admin app.
 *
 * `db/client.ts` connects to the product Postgres as the `postgres` role,
 * which has BYPASSRLS — nothing in the database scopes admin's reads. This
 * single allowed domain, checked in `proxy.ts` on every request and again in
 * `lib/require-admin.ts` on every gated page, is the only thing standing
 * between the public internet and every user's data.
 *
 * Read from env, not hardcoded, so the allowed domain can change without a
 * deploy.
 */
const rawDomain = process.env.ADMIN_EMAIL_DOMAIN ?? "";
export const ADMIN_EMAIL_DOMAIN = rawDomain.trim().toLowerCase();

/**
 * True when no domain is configured — every sign-in is denied. Surfaced on
 * the login page so a deploy that forgot ADMIN_EMAIL_DOMAIN fails loudly
 * instead of locking out every operator with a generic "unauthorized".
 */
export const ADMIN_EMAIL_DOMAIN_UNSET = ADMIN_EMAIL_DOMAIN.length === 0;

/**
 * True when `email`'s domain exactly matches ADMIN_EMAIL_DOMAIN
 * (case-insensitive). An unset ADMIN_EMAIL_DOMAIN denies everyone — fail
 * closed, never fail open on a missing env var.
 */
export function isAllowedAdminEmail(email: string | null | undefined): boolean {
  if (ADMIN_EMAIL_DOMAIN_UNSET) return false;
  if (!email) return false;

  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at === -1 || at === normalized.length - 1) return false;
  const domain = normalized.slice(at + 1);

  // Exact match only — endsWith would let "evil-example.com" through an
  // "example.com" rule.
  return domain === ADMIN_EMAIL_DOMAIN;
}
