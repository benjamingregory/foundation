import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Globbed with a leading **/ so these match at any depth. Bare ".next/**"
    // only matches the top-level build dir, so `eslint .` was descending into
    // website/.next/ and linting minified Turbopack chunks — 4,198 of the
    // 4,382 problems this config reported came from build output, not source.
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/next-env.d.ts",
    // website/ is its own package with its own eslint.config.mjs and lint
    // script; linting it from the root would apply the wrong config.
    "website/**",
  ]),
]);

export default eslintConfig;
