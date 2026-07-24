"use server";

import { supabaseEnvConfigured, supabaseServer } from "@/lib/supabase/server";
import { isAllowedAdminEmail, ADMIN_EMAIL_DOMAIN_UNSET } from "@/lib/auth-config";

export type LoginResult = { ok: boolean; message: string };

/**
 * Supabase email+password sign-in, gated to ADMIN_EMAIL_DOMAIN.
 *
 * The domain check runs AFTER Supabase verifies the password (so a wrong
 * password on a disallowed address reads as "invalid credentials", not "not
 * an operator" — no domain enumeration) but BEFORE the caller ever treats
 * the session as valid: a correct password on a disallowed domain is signed
 * out immediately here, so a valid-but-denied cookie never reaches the
 * browser from this path. proxy.ts and requireAdmin() re-check the same
 * gate on every subsequent request — this is defense in depth, not the only
 * layer.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  if (ADMIN_EMAIL_DOMAIN_UNSET) {
    return {
      ok: false,
      message: "No admin domain is configured on this deployment. Set ADMIN_EMAIL_DOMAIN.",
    };
  }
  if (!supabaseEnvConfigured()) {
    return { ok: false, message: "Supabase is not configured on this deployment." };
  }

  const normalized = email.trim().toLowerCase();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalized,
    password,
  });

  if (error || !data.user) {
    return { ok: false, message: error?.message ?? "Invalid email or password." };
  }

  if (!isAllowedAdminEmail(data.user.email)) {
    await supabase.auth.signOut();
    return { ok: false, message: "That account is not an operator." };
  }

  return { ok: true, message: "Signed in." };
}
