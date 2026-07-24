import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo holds three Next apps (web/, website/, admin/), each with its own
  // lockfile. Pin the root here so Turbopack doesn't infer it from a sibling.
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: [
    "postgres",
    "drizzle-orm",
    "@mastra/core",
    "@mastra/pg",
    "@mastra/memory",
    "@mastra/ai-sdk",
  ],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@base-ui/react",
      "@tanstack/react-query",
    ],
  },
};

export default nextConfig;
