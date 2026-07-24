import type { Metadata } from "next";
import { getAdmin } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "foundation admin",
  description: "Internal operator console.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // proxy.ts has already rejected anyone not on ADMIN_EMAIL_DOMAIN for every
  // non-/login request, so this is for display only — it is not the gate.
  // Each gated page calls requireAdmin() itself (lib/require-admin.ts):
  // defense in depth, not this layout's job.
  const admin = await getAdmin();

  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {admin && (
          <header className="border-b border-border">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <span className="text-sm font-medium">
                foundation
                <span className="ml-1.5 text-muted-foreground">admin</span>
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {admin.email}
              </span>
            </div>
          </header>
        )}
        <main className="px-4 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </body>
    </html>
  );
}
