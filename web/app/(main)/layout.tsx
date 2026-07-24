import { requireUser } from "@/lib/auth/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { ensureProfile } from "@/lib/data/ensure-profile";
import { JobsDock } from "@/components/jobs/jobs-dock";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirects to /sign-in when there's no session.
  const user = await requireUser();
  // Idempotent (userId-primary-keyed insert); fires `user/signed-up` exactly
  // once, on first sight of this user. Supabase email is optional on the
  // session type even though our own sign-up flow always collects one.
  if (user.email) await ensureProfile(user.id, user.email);

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-heading text-lg text-foreground">
          foundation
        </span>
        <ThemeToggle />
      </header>
      <main>{children}</main>
      <JobsDock />
    </div>
  );
}
