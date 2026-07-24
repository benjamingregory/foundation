import { redirect } from "next/navigation";
import { getAdmin, type Admin } from "@/lib/supabase/server";

/**
 * Call from every gated page's Server Component. Redirects to /login when
 * there is no session, or the signed-in account's email domain doesn't
 * match ADMIN_EMAIL_DOMAIN.
 *
 * proxy.ts already enforces the same rule at the edge for every non-/login
 * request. This is the second layer, so a page reached by any path proxy.ts
 * doesn't cover — a direct RSC render, a future route mistakenly added to
 * PUBLIC_PATHS — still can never render product data to a non-operator.
 */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  return admin;
}
