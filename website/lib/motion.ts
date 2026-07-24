// JS-side easing tokens for motion/react. `ease` props on motion components
// take numeric cubic-bezier arrays, not CSS `var()` strings, so these are the
// canonical source for this app's two easing curves — nothing in globals.css
// defines a matching CSS custom property today.
export const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;
export const EASE_EMPHASIS = [0.23, 1, 0.32, 1] as const;
