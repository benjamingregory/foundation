import { requireUser } from "@/lib/auth/server";
import { billingConfigured } from "@/services/billing";
import { getPlan } from "@/services/entitlements";
import { BillingView } from "@/components/billing/billing-view";

export default async function BillingSettingsPage() {
  const user = await requireUser();
  const plan = await getPlan(user.id);

  return <BillingView plan={plan} configured={billingConfigured()} />;
}
