import { ADMIN_EMAIL_DOMAIN_UNSET } from "@/lib/auth-config";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · foundation admin" };

export default function LoginPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <LoginForm domainUnset={ADMIN_EMAIL_DOMAIN_UNSET} />
    </div>
  );
}
