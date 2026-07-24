/**
 * Email palette + URL base, split from the JSX layout so plain-TS callers
 * (services, Inngest functions) can import them without touching React.
 *
 * Hex analogs of the app's dark-mode tokens in app/globals.css — same hue
 * architecture (neutrals at hue ~210, accent at hue ~195) — because email
 * clients don't render `oklch()` reliably. This file is the one place that
 * translates the token set to hex for email use; if the app palette moves,
 * re-derive these from the updated `.dark` block in globals.css.
 */

/**
 * Contrast ratios below are against `bg` (#090e0f). WCAG AA needs 4.5:1 for
 * body text and 3:1 for meaningful non-text. Re-check with a contrast tool
 * before changing any value here.
 */
export const EMAIL_COLORS = {
  bg: "#090e0f",
  /** Raised surface — the one card-level element an email might use. */
  card: "#131a1b",
  text: "#f2f6f6", // 17.8:1
  muted: "#9aa7aa", // 7.8:1
  /** Row dividers / hairlines. Deliberately below the 3:1 non-text
   *  threshold: decorative separation, not a boundary that carries meaning. */
  border: "#2d3436",
  link: "#57d4d4", // 10.9:1
} as const;

/**
 * Arial/Helvetica sit ahead of the generic fallback on purpose: Outlook's
 * Word rendering engine ignores font stacks it doesn't recognize and falls
 * through to Times New Roman, so a stack led by `ui-sans-serif, system-ui`
 * renders the whole email as a serif there.
 */
export const EMAIL_FONT =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Arial, Helvetica, sans-serif";

export function baseUrl(): string {
  return (
    process.env.APP_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000"
  );
}
