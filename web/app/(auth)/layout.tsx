import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      <Link href="/" className="font-heading text-2xl text-foreground">
        foundation
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
