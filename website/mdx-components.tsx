import type { MDXComponents } from "mdx/types";
import Link from "next/link";

// Required by @next/mdx for the App Router: the loader looks for this file
// (any nesting depth) and merges its output with each MDX page's own
// component overrides. This is where markdown elements get this app's
// tokens instead of unstyled browser defaults — no @tailwindcss/typography
// plugin in the dependency set, so the mapping does that work by hand.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props) => (
      <h1
        className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl"
        {...props}
      />
    ),
    h2: (props) => (
      <h2
        className="mt-4 text-xl font-semibold tracking-tight text-foreground"
        {...props}
      />
    ),
    h3: (props) => (
      <h3 className="text-lg font-medium text-foreground" {...props} />
    ),
    p: (props) => (
      <p
        className="text-base leading-relaxed text-muted-foreground"
        {...props}
      />
    ),
    ul: (props) => (
      <ul
        className="flex flex-col gap-2 text-base leading-relaxed text-muted-foreground"
        {...props}
      />
    ),
    li: (props) => (
      <li className="ml-5 list-disc marker:text-border" {...props} />
    ),
    strong: (props) => (
      <strong className="font-medium text-foreground" {...props} />
    ),
    code: (props) => (
      <code
        className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground"
        {...props}
      />
    ),
    a: ({ href, ...props }) => {
      const linkClasses =
        "font-medium text-accent underline underline-offset-4";
      if (href?.startsWith("/")) {
        return <Link href={href} className={linkClasses} {...props} />;
      }
      return <a href={href} className={linkClasses} {...props} />;
    },
    ...components,
  };
}
