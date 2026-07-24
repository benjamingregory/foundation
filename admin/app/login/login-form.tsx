"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { login, type LoginResult } from "./actions";

const PROXY_ERRORS: Record<string, string> = {
  not_allowed: "That account is not an operator.",
};

function Form({ domainUnset }: { domainUnset: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<LoginResult | null>(null);
  const [pending, startTransition] = useTransition();
  const proxyError = params.get("error");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await login(email, password);
      setResult(res);
      if (res.ok) {
        router.push("/users");
        router.refresh();
      }
    });
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-medium">
          foundation <span className="text-muted-foreground">admin</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Operator console. Access is limited to ADMIN_EMAIL_DOMAIN.
        </p>
      </div>

      {/* Without this, a deploy that forgot ADMIN_EMAIL_DOMAIN rejects every
          sign-in and looks like a bug in auth rather than a missing env var. */}
      {domainUnset && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No admin domain is configured. Set{" "}
          <code className="font-mono">ADMIN_EMAIL_DOMAIN</code> or every sign-in
          is denied.
        </div>
      )}

      {proxyError && !result && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {PROXY_ERRORS[proxyError] ?? "Something went wrong."}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg bg-card px-3 py-2.5 text-sm ring-1 ring-foreground/10 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg bg-card px-3 py-2.5 text-sm ring-1 ring-foreground/10 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          type="submit"
          disabled={pending || !email || !password}
          className="w-full"
          size="lg"
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {result && !result.ok && (
        <p className="text-sm text-destructive">{result.message}</p>
      )}
    </div>
  );
}

export function LoginForm({ domainUnset }: { domainUnset: boolean }) {
  return (
    <Suspense>
      <Form domainUnset={domainUnset} />
    </Suspense>
  );
}
