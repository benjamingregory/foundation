import type { ReactNode } from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import { EMAIL_COLORS, EMAIL_FONT } from "./theme";

/**
 * Shared shell for transactional email — one place for the palette and
 * wordmark so every email in the app reads as the same product.
 * react-email components inline all styles at render time.
 *
 * This is a transactional shell only: no unsubscribe wiring. If a project
 * adds recurring email (digests, alerts), it needs signed one-click
 * unsubscribe links — see jobflow's `lib/email/unsubscribe.ts` for the
 * HMAC-token + RFC 8058 `List-Unsubscribe` header recipe.
 */
export function EmailLayout({
  preview,
  footerNote,
  children,
}: {
  /** Preheader text shown next to the subject in inbox lists. */
  preview?: string;
  /** Why the recipient got this email — sits under the content. */
  footerNote: string;
  children: ReactNode;
}) {
  const c = EMAIL_COLORS;
  return (
    <Html>
      <Head />
      {preview ? <Preview>{preview}</Preview> : null}
      <Body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: c.bg,
          color: c.text,
          fontFamily: EMAIL_FONT,
        }}
      >
        {/*
          The background lives on this full-width table, not only on <body>.
          Several clients drop or ignore a body-level background; when that
          happens the near-white text lands on the client's default white
          and the email is unreadable. The bgcolor attribute is there for
          the same reason — Outlook's Word engine honors the attribute more
          reliably than the CSS property.
        */}
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          bgcolor={c.bg}
          style={{
            backgroundColor: c.bg,
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <tbody>
            <tr>
              {/* React's td types omit `bgcolor`; the table above carries
                  the attribute, and this cell repeats the CSS background so
                  a client that ignores one still paints the other. */}
              <td style={{ backgroundColor: c.bg, padding: 24 }}>
                <Container style={{ maxWidth: 560, margin: "0 auto" }}>
                  <Text
                    style={{ fontWeight: 600, margin: "0 0 16px", color: c.text }}
                  >
                    foundation
                  </Text>
                  {children}
                  <Text
                    style={{
                      color: c.muted,
                      fontSize: 13,
                      margin: "24px 0 0",
                      paddingTop: 16,
                      borderTop: `1px solid ${c.border}`,
                    }}
                  >
                    {footerNote}
                  </Text>
                </Container>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  );
}
