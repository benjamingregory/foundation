# Design Principles

Guidelines for UI/UX design in foundation — a copyable Next.js starter (`web/` product app, `website/` marketing site, `admin/` ops shell). Adapted from Linear, Vercel, Stripe, Raycast, and Notion. Treat this as the default for `web/` and `admin/`; project-specific work should extend it, not silently diverge from it.

---

## Core Philosophy

**Focus over features.** Every screen should answer one question clearly. Remove anything that doesn't directly serve the user's immediate goal.

**Speed is a feature.** Every interaction should feel instant. Animations that delay action are worse than no animation at all.

---

## Design Skills — which one, when

Split by altitude, and by *when in the loop* they fire — see [CLAUDE.md § How work gets done](CLAUDE.md) for the gates these map to. Invoke them **before** writing code, not after.

| Skill | Gate | Use it for | Don't use it for |
| --- | --- | --- | --- |
| **`intent`** | G1 | *What should exist and for whom* — problem framing, evidence, measurement. A new surface, or a feature whose value is assumed. | A visual change to something whose purpose is already settled. |
| **`hallmark`** | G4 | *What goes where* — structure, hierarchy, spacing rhythm, component composition, empty/loading/error shape. A new page, a redesign, an audit of UI you didn't write. | Pure motion work. Tuning an easing curve. |
| **`impeccable`** | G6 | The vocabulary behind a specific decision, then its ordered passes: `/critique` → `/polish` → `/audit`. | Deciding what a surface is for. That's G1. |
| **`emil-design-eng`** | G6 | *How it moves* — animation, transitions, hover/press feedback, popovers, drawers, toasts, gesture handling. | Deciding page structure or what a section contains. |
| **`find-animation-opportunities`** | G6, first | Deciding where motion earns its place — and what to leave still. | Implementing the motion once decided. |
| **`review-animations`** | G8 | A strict pass over motion that already shipped. | Anything before the motion exists. |
| **`improve-animations`** | Rhythm | A codebase-wide animation audit returning prioritized plans. File each as a bd issue. | A single surface. That's `/critique` plus emil. |
| **`pick-ui-library`** | G5 | Choosing a UI dependency, after checking `components/ui/` and finding nothing that fits. | Reaching past a Base UI or shadcn primitive that already exists. |

Most UI tasks run intent (if new) → hallmark → build → impeccable → emil. All of them defer to this document where they conflict.

### What hallmark contributes here

Its structural discipline, its slop/a11y/responsive gates, and its honesty rules:

- **Structural variety** — not every surface is a header + 3 cards + CTA. Section rhythm should follow the content, not a template.
- **Honest copy — no fabricated content.** Never invent a metric, count, testimonial, or logo. If the project didn't supply a number, use a real one from the DB, a labelled placeholder, or a different layout. (Reinforces [LANGUAGE_PATTERNS.md](LANGUAGE_PATTERNS.md): if there's no number, drop the claim.)
- **Locked tokens — no mid-render improvisation.** Every color and font references a named token. No inline hex / `rgb()` / OKLCH, no bare `font-family`.
- **No re-drawn chrome.** No hand-built fake browser bars, phone frames, or IDE windows.
- **Mobile verified at 320 / 375 / 414 / 768px.** No horizontal scroll, no two-line buttons or nav links, `overflow-x: clip` (never `hidden`) on root.
- **8-state discipline** on every interactive component: default, hover, `:focus-visible`, `:active`, disabled, loading, error, success.

### What hallmark must NOT do here

**The theme is already chosen.** Hallmark's default flow picks from a 22-theme catalog and can construct a custom OKLCH palette + font pairing. **Both are disabled in the product apps (`web/`, `admin/`).** These apps ship one locked token set in [app/globals.css](web/app/globals.css) — hallmark's pre-flight scan reads those tokens and treats them *as* the theme. It brings structure; it does not bring color or type.

- No new palettes, no new fonts, no unpaired light/dark tokens (see § Light + dark theming below).
- Reach for `components/ui/` (Base UI + shadcn) before hallmark builds a primitive from scratch.
- Where hallmark's page-level apparatus (macrostructure, hero enrichment, footer archetypes) collides with the density and progressive-disclosure rules in this document, **this document wins**. Most in-app work is component-scope — hallmark's tighter flow — not page-scope.
- Hallmark's **full** design flow, theme selection included, applies only to the standalone marketing site in [website/](website/): separate app, separate tokens, no locked-palette constraint.

---

## 1. Information Hierarchy

### The 80/20 Rule

Show 20% of data that drives 80% of decisions. Everything else should be accessible but hidden by default.

### Visual Priority

- **Primary**: 1 main action or piece of information per view
- **Secondary**: 2-3 supporting elements
- **Tertiary**: Everything else collapsed or on separate pages

### Lead with the decision-relevant fact

List rows and detail views should lead with whatever single fact drives the user's next decision — a status, a price, a count, a due date. Everything else is supporting context — keep it secondary. If your project has a status canon (e.g. `pending | active | done | failed`), define it once, enforce it with a DB CHECK constraint, and reuse the same set of tokens/colors everywhere it's rendered rather than inventing per-surface variants.

---

## 2. Progressive Disclosure

### Default to Less

- Show 3-5 items by default, not all items
- Use "View all (X)" links for complete lists
- Collapse secondary sections by default
- Persist expansion state in localStorage where it makes sense

### Reveal on Demand

```
Good: Show 5 most recent items + "View all"
Bad:  Show all 47 items on the dashboard
```

### Smart Defaults

- Pre-filter to active/actionable states — hide closed/archived/discarded items by default
- Show most recent / most actionable first
- Hide empty sections until they have content

---

## 3. Whitespace & Density

### Productivity-Tool Density

Lean denser than typical SaaS marketing sites — Linear-style, not Stripe-marketing-style — for anything in `web/` or `admin/`. Target 55-70% content, 30-45% whitespace.

### Spacing Guidelines

| Element | Spacing |
|---------|---------|
| Between major sections | 24px (`space-y-6`) |
| Between cards/items | 8-12px (`gap-2` to `gap-3`) |
| Within cards | 8-12px (`p-3` to `p-4`) |
| Page padding | 16-24px |
| Sidebar internal | 16px horizontal |

### Card Design

- Light borders, minimal shadow
- Subtle backgrounds over heavy borders
- Don't wrap simple lists in cards — let whitespace do the work

---

## 4. Component Limits

### Dashboard

- **Maximum**: 6-8 cards visible on default view
- **Ideal**: 3-4 focused sections
- Anything reachable via the sidebar doesn't need a dashboard card

### List Items

- **Default visible**: 5-10 items
- **With pagination/virtualization**: 50+
- Always show total count when truncating

---

## 5. Layout Patterns

### Single-Column Focus

For task-oriented surfaces (an item's detail view, a settings form), single-column layouts reduce cognitive load:

```
┌─────────────────────────────────┐
│  Primary action / status        │
│                                 │
│  Main content                   │
│                                 │
│  Secondary actions (compact)    │
└─────────────────────────────────┘
```

### When to Use Multi-Column

- Compare views (side-by-side records)
- Filterable browse surfaces
- Settings forms with grouped sections

### Dialogs vs. Inline vs. Full Page

| Use this | For |
|----------|-----|
| **Full page** | Anything with a stable URL (a record, a draft, settings) |
| **Dialog (Base UI)** | Confirmations, quick edits, content-heavy modals |
| **Inline expansion** | Section-level detail within a list (row → expanded detail) |
| **Toast** | Async feedback (saved, generated, failed) |

Never use a dialog for something that needs a URL. Never use a page for a confirmation.

### Responsive Behavior

- Desktop (xl+): Full layout, sidebar visible
- Tablet (md-xl): Collapsible sidebar, content-first
- Mobile (<md): Single column, stacked, essentials only

---

## 6. Color & Visual Indicators

### Identity

The starting palette is **cool graphite + a teal accent** — every neutral is tinted toward hue 210 at low chroma, and `--primary` is a teal accent (hue ~195) chosen to stay clear of common status hues (destructive sits at hue ~22). The rules:

- All neutrals carry the hue-210 tint. Never reintroduce an achromatic (`0 0`-chroma) surface token.
- The primary accent is the *brand* color (primary buttons, focus ring, links in chrome). Reserve it for identity, not for encoding arbitrary meaning.
- Light and dark scopes mirror the same hue architecture rather than inventing a second palette: dark surfaces get lighter as they elevate off a near-black base; light surfaces get lighter still — toward white — as they elevate off an off-white base. See the comment above the token block in [app/globals.css](web/app/globals.css).
- Radius and spacing carry density; don't tighten radii to fake density — use the compact control sizes instead.

### Status colors

If your project has a status/state canon, map each state to a color deliberately and consistently, and put the mapping in one place (a small `lib/ui/status-colors.ts`-style helper), not scattered `bg-blue-500/10` literals across components. Never hardcode a raw Tailwind palette class for status meaning — emit token-backed classes so the mapping can be tuned centrally.

### Accessibility

- Never use color alone to convey meaning
- Provide text labels or icons alongside color
- Maintain 4.5:1 contrast ratio minimum, in both themes

---

## 7. Empty States

### Be Helpful, Not Decorative

```
Good:
"No items yet — create your first one to get started"
[Create item →]

Bad:
🎉 Big illustration
"Nothing here yet!"
"Check back later"
```

### Requirements

- Brief explanation of what would appear here
- Clear action to populate (button or link to the relevant form/flow)
- Reasonable padding (16-24px vertical, not 40+)
- For sections in a dashboard, consider hiding entirely until populated
- Route-level empties can use a component like `EmptyState`; inline and section-level empties go icon-less (a sentence + action) — reserve icon medallions for the route level

---

## 8. Loading States

### Skeleton Screens (Preferred)

Use skeletons that match the actual content shape rather than a single spinner.

### Streaming-First UI

Any surface that streams tokens from an LLM (chat, agent output) should render incrementally — show content as soon as it arrives rather than waiting for the full response. Use the AI SDK's streaming primitives (`@ai-sdk/react`) instead of awaiting completion.

### Anti-pattern

```
Bad:  Single full-screen spinner blocking the whole page
Good: Skeleton shape + progressive token streaming
```

---

## 9. Navigation

### Don't Duplicate

If something is reachable from the top nav, it doesn't need a dashboard card pointing at it.

### View state

View state that survives refresh lives in the URL (`?view=`, `?filter=`, `?sort=`, `?q=`, `?tab=`, …) via `router.replace(..., { scroll: false })` — one writer per view, parsed from `useSearchParams()`.

### Reduce Clicks

- Direct links to specific records, not just list pages
- Keyboard shortcuts for power users
- Status/filter pills clickable as filters

---

## 10. Animation & Motion

### The motion sequence

Motion has its own three-step sequence inside G6, and running it out of order is how UIs end up animating things that should have stayed still.

1. **`find-animation-opportunities`** — decide *where* motion earns its place, and what to leave alone. Run this before animating anything, not after.
2. **`emil-design-eng`** — implement it. The skill encodes Emil Kowalski's philosophy on UI polish, easing curves, durations, spring physics, gesture handling, performance, and accessibility, including the decision framework (should this animate? what purpose? what easing? how fast?). Reach for **`animation-vocabulary`** when a motion note keeps coming back wrong — usually the words were imprecise, not the implementation.
3. **`review-animations`** — a strict review pass at G8. It provides a Before/After table format that surfaces the common failures (`transition: all`, `scale(0)` entries, `ease-in` on UI, wrong `transform-origin`).

**`improve-animations`** is the periodic version: it audits every animation in the codebase and returns prioritized, self-contained plans. File each plan as its own bd issue rather than executing the whole set in one pass.

### foundation addendum: use Motion, not CSS-only transitions, and never `framer-motion`

**Do not use CSS-only transitions or `@keyframes` for new interactive animations.** foundation standardizes on [Motion](https://motion.dev), imported from **`motion/react`** — never `framer-motion`. The two packages ship separate React contexts: if a dependency pulls in `framer-motion` and the app also imports `motion/react`, you end up with two independent `AnimatePresence` trees that can't see each other's exit animations. `web/package.json` lists `motion` only — keep it that way; don't `pnpm add framer-motion` to satisfy some other library's peer dependency without checking for this hazard first.

The skill's examples often show CSS — translate the principles into Motion equivalents:

| CSS approach (skill examples) | Motion equivalent |
| --- | --- |
| `transition: transform 200ms ease-out` | `<motion.div animate={{ ... }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} />` |
| `@keyframes` for entry | `<motion.div initial={...} animate={...} exit={...} />` with `AnimatePresence` |
| `:active { transform: scale(0.97) }` | `<motion.button whileTap={{ scale: 0.97 }} />` |
| `@starting-style` for mount | `initial` + `animate` props on `motion.*` |
| Custom CSS easing variables | Inline cubic-bezier arrays in Motion's `transition.ease`, or the shared curves in `web/lib/motion.ts` |

**Why:** Motion gives interruptible animations, spring physics, layout animations, and gesture support that CSS can't match. Keeping motion in one system also keeps the codebase consistent.

**Tailwind hover utilities are still fine.** `hover:bg-muted/50`, `hover:shadow-sm`, `hover:border-border` are state changes, not animations — keep using them. The Motion rule applies to anything you'd otherwise express as a keyframe or JS-driven CSS-transition for entry/exit/morph behavior.

**The split is by kind, not by size.** `pick-ui-library` says a simple hover or fade doesn't need a motion library. Half right: a hover *state* doesn't, but a fade with an exit does — `AnimatePresence` has to own the unmount, and an element driven by both CSS transitions and Motion is where jank comes from. State changes stay CSS; entry, exit, morph, and gesture go through Motion however trivial they look.

### Spring configuration

Use the named springs in [web/lib/motion.ts](web/lib/motion.ts) — `spring.snap`, `spring.smooth`, `spring.soft`, `spring.pop`, `spring.panel`. They're `{ stiffness, damping }`; `emil-design-eng` recommends the `{ duration, bounce }` form as easier to reason about, and it is, but a codebase carrying both conventions is worse than either. Add a new named spring to the token file rather than inlining a config.

Springs are for **gesture, drag, and interruptible** motion, plus deliberate decorative touches. Discrete UI transitions — dropdowns, tooltips, dialogs — use `duration` + `ease` from the same file. `apple-design` reads as spring-first because its subject is gesture-driven surfaces; scoped that way it agrees with emil rather than contradicting him.

### Translucency and materials

`apple-design` § 12 treats translucent materials as a hierarchy signal. **Use it sparingly here.** This is a dense productivity tool with Linear and Raycast as reference apps, not a consumer OS surface: translucency over a data-dense background costs legibility, and legibility is the whole point of § 1. Backdrop blur is acceptable on a modal scrim or a floating command surface, where there's a real depth relationship to convey. It is not a default treatment for cards, sidebars, or table rows. Apple's own rule holds regardless — never stack one translucent surface on another.

**Exception, deliberate:** [components/ui/skeleton.tsx](web/components/ui/skeleton.tsx) is CSS-only on purpose — it sits on the critical path of nearly every route's loading state, and pulling Motion into that path would ship the whole animation library on the first paint of a route that hasn't loaded anything yet. Don't "fix" it to use Motion; don't use it as precedent for other components.

### Carry over from the skill (apply via Motion)

- Custom easing curves (`[0.23, 1, 0.32, 1]` for ease-out, etc.) — built-ins are too weak. `web/lib/motion.ts` already exports `ease`, `duration`, `spring`, and `tap` — reuse those instead of inlining new ones.
- Sub-300ms durations for UI animations (150-250ms is the sweet spot)
- **Never animate keyboard-initiated actions** — command palette, sidebar toggle, etc. open instantly
- `whileTap={{ scale: 0.97 }}` for press feedback on buttons
- `initial={{ scale: 0.95, opacity: 0 }}` — never animate from `scale(0)`
- Origin-aware popovers (scale from trigger, not center; modals exempt — keep centered)
- Respect `prefers-reduced-motion` via Motion's `useReducedMotion()` hook

### Performance caveat

Motion's `x` / `y` / `scale` shorthand props are NOT hardware-accelerated. Under load (page transitions, streaming responses, heavy lists), use the full `transform` string (`animate={{ transform: "translateX(100px)" }}`) so animations stay off the main thread.

### Streaming-aware motion

When content streams in (chat, agent output), don't animate every chunk. Animate the container appearance once, then let tokens fill in without per-token motion. Per-token animation makes streaming feel slower than it is.

---

## 11. Light + dark theming

foundation ships **dark-first with a maintained light theme** — this is not a dark-only app. `ThemeProvider` (`attribute="class"`, `defaultTheme="dark"`, `enableSystem`, in [components/providers.tsx](web/components/providers.tsx)) plus [components/theme-toggle.tsx](web/components/theme-toggle.tsx) let the user switch, and the system preference is honored on first load.

**The hard rule: both `:root` (light) and `.dark` scopes in [app/globals.css](web/app/globals.css) must define every color token, under the same variable names.** No unpaired vars — if you add a token to one scope, add its counterpart to the other in the same change. A component that reads a token missing from one scope silently falls back to an unstyled or browser-default value in that theme, which only shows up when someone actually toggles to it. `pnpm typecheck` and `pnpm lint` won't catch a missing CSS custom property — this is a manual-diligence rule, not a compiler-enforced one.

When extending the palette:

- Add the token to `:root` first, pick the light value, then add the same name to `.dark` with the dark-appropriate value — never leave one scope with a var the other lacks.
- Mirror the existing hue architecture (see § Color & Visual Indicators) rather than inventing a new one per token.
- Verify both themes via the theme toggle before calling a surface done — the design checklist below has a line item for this.

---

## 12. Design Checklist

Before shipping any UI:

- [ ] Can I remove any element without losing core value?
- [ ] Is the primary action obvious within 2 seconds?
- [ ] Are lists limited to 5-10 items by default?
- [ ] Does loading use streaming + skeletons (not a single spinner)?
- [ ] Does it work without color (accessibility)?
- [ ] Are empty states helpful and actionable?
- [ ] Does it work on mobile?
- [ ] Does it work in **both** light and dark theme — every token paired, nothing falling back unstyled?
- [ ] Are animations done in Motion (`motion/react`), never CSS keyframes or `framer-motion`?
- [ ] G1: Did I run `intent` if this surface is new, or its value assumed rather than evidenced?
- [ ] G4: Did I run `hallmark` before writing layout code — new surface, redesign, or audit?
- [ ] G5: Did I check `components/ui/` (and run `pick-ui-library`) before adding a UI dependency?
- [ ] G6: Did I run `/critique` → `/polish`, then `find-animation-opportunities` → `emil-design-eng` for any motion?
- [ ] G8: Did I run `/design-review` against a live server, and `review-animations` if motion changed?
- [ ] Did any skill example bring in a `framer-motion` import? (emil's `useSpring` sample does — rewrite to `motion/react`.)
- [ ] Did I stay out of `/colorize`, `/bolder`, and `/delight` in `web/` and `admin/`?
- [ ] Does every color and font reference a token — no inline hex / OKLCH / `font-family`?
- [ ] Are all 8 states covered on interactive components (default, hover, focus-visible, active, disabled, loading, error, success)?
- [ ] Is every number, count, and quote real — nothing invented for the layout?

---

## Reference Apps

Study these for inspiration:

- **Linear**: Keyboard-first navigation, dense lists, minimal chrome, fast everything
- **Raycast**: Command palette UX, instant-feel interactions, no-animation policy on hot paths
- **Vercel Dashboard**: Productivity-tool density, status pills, deployment-style timelines
- **Stripe Dashboard**: Information hierarchy in data-heavy views
- **Notion**: Flexible layouts without clutter

---

## Anti-Patterns to Avoid

| Anti-Pattern | Better Approach |
|--------------|-----------------|
| Show everything at once | Progressive disclosure |
| Full-screen spinner during streaming | Skeleton shapes + token streaming |
| Heavy card borders/shadows | Subtle backgrounds, ring-style borders |
| Multiple CTAs competing | Single primary action |
| Decorative empty states | Actionable guidance |
| Color-only status | Color + text/icon |
| Animation on keyboard-triggered actions | Instant — no animation |
| New `@keyframes` or CSS-only transitions for animation | Use Motion (`motion/react`) |
| `framer-motion` alongside `motion/react` | One motion library — `motion/react` only |
| Per-token animation during streaming | Animate container once, let tokens fill in |
| Built-in CSS named easings (`ease-out`, etc.) | Custom cubic-bezier arrays from `web/lib/motion.ts` |
| `transition: all` | Specify exact properties; better — express in Motion |
| Sparkles icon for "AI" | Communicate AI through copy or a domain-specific icon |
| Every surface shaped header + 3 cards + CTA | Structural variety — section rhythm follows the content |
| Invented metrics, counts, or testimonials to fill a layout | Real data, a labelled placeholder, or a different layout |
| Inline hex / OKLCH / `font-family` in a component | Named tokens from [app/globals.css](web/app/globals.css) |
| Hand-drawn browser bars, phone frames, fake IDE chrome | Real screenshots in a `<figure>`, or no chrome at all |
| Shipping a component with only default + hover | All 8 states, including `:focus-visible`, loading, error |
| Adding a color token to only `:root` or only `.dark` | Define the same token name in both scopes, same change |
