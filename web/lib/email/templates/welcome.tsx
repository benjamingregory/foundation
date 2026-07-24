import { Heading, Link, Text } from "@react-email/components";
import { EmailLayout } from "../layout";
import { EMAIL_COLORS, baseUrl } from "../theme";

/**
 * First email a new account gets. Consumed by the Task 10 Inngest welcome
 * function via `sendEmail({ react: <WelcomeEmail name={...} /> })`.
 */
export function WelcomeEmail({ name }: { name?: string } = {}) {
  const dashboardUrl = `${baseUrl()}/dashboard`;
  return (
    <EmailLayout
      preview="Your foundation account is ready."
      footerNote="You're getting this because you created a foundation account."
    >
      <Heading
        as="h1"
        style={{ fontSize: 20, margin: "8px 0 12px", color: EMAIL_COLORS.text }}
      >
        Welcome{name ? `, ${name}` : ""}
      </Heading>
      <Text
        style={{
          margin: 0,
          fontSize: 15,
          lineHeight: "22px",
          color: EMAIL_COLORS.text,
        }}
      >
        Your foundation account is ready. Sign in and open the{" "}
        <Link href={dashboardUrl} style={{ color: EMAIL_COLORS.link }}>
          dashboard
        </Link>{" "}
        to start working.
      </Text>
    </EmailLayout>
  );
}

export default WelcomeEmail;
