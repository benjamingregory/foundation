import type { Transition } from "motion/react";

// Custom easing curves. Built-in named easings (ease-out, ease-in-out) are
// too weak for UI — use these arrays via Motion's transition.ease.
export const ease = {
  out: [0.23, 1, 0.32, 1] as const,
  inOut: [0.77, 0, 0.175, 1] as const,
  drawer: [0.32, 0.72, 0, 1] as const,
};

export const duration = {
  press: 0.12,
  fast: 0.16,
  normal: 0.2,
  slow: 0.25,
};

export const spring = {
  snap: { type: "spring", stiffness: 320, damping: 28 } satisfies Transition,
  smooth: { type: "spring", stiffness: 240, damping: 30 } satisfies Transition,
  soft: { type: "spring", stiffness: 200, damping: 32 } satisfies Transition,
  /** Confident pop for confirming a discrete action — copy ticks, status
   *  rolls, saved checks. Slight overshoot, settles fast. */
  pop: { type: "spring", stiffness: 500, damping: 30 } satisfies Transition,
  /** Peek-panel slide. Critically damped enough to never bounce a 520px sheet. */
  panel: { type: "spring", stiffness: 300, damping: 30 } satisfies Transition,
};

export const tap = { scale: 0.97 };

/** How long transient success feedback (Copied, Saved) dwells before reverting. */
export const feedbackDwellMs = 2000;

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: duration.fast, ease: ease.out },
};

export const fadeSlideUp = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: duration.normal, ease: ease.out },
};

export const stagger = {
  container: {
    animate: { transition: { staggerChildren: 0.04 } },
  },
  item: {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0, transition: { duration: duration.fast, ease: ease.out } },
  },
};
