"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiJson } from "@/lib/data/api-fetch";
import type { BillingPlan } from "@/db/schema/billing";

type BillingViewProps = {
  plan: BillingPlan;
  configured: boolean;
};

type SessionKind = "checkout" | "portal";

export function BillingView({ plan, configured }: BillingViewProps) {
  const [pending, setPending] = useState<SessionKind | null>(null);

  async function openSession(kind: SessionKind) {
    setPending(kind);
    try {
      const { url } = await apiJson<{ url: string }>(`/api/billing/${kind}`, {
        method: "POST",
      });
      window.location.href = url;
    } catch {
      // apiJson already toasted the error — just stop blocking the button.
      setPending(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your plan and payment details.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current plan
            <Badge variant={plan === "pro" ? "default" : "secondary"}>
              {plan === "pro" ? "Pro" : "Free"}
            </Badge>
          </CardTitle>
          <CardDescription>
            {plan === "pro"
              ? "Your subscription is active."
              : "Upgrade to Pro for full access."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!configured ? (
            <p className="text-sm text-muted-foreground">
              Billing is not configured on this deployment.
            </p>
          ) : plan === "pro" ? (
            <Button
              onClick={() => openSession("portal")}
              disabled={pending !== null}
            >
              {pending === "portal" ? "Opening…" : "Manage billing"}
            </Button>
          ) : (
            <Button
              onClick={() => openSession("checkout")}
              disabled={pending !== null}
            >
              {pending === "checkout" ? "Redirecting…" : "Upgrade"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
