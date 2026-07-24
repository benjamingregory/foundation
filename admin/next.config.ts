import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo holds three Next apps (web/, website/, admin/), each with its own
  // lockfile. Pin the root here so Turbopack doesn't infer it from a sibling.
  turbopack: {
    root: __dirname,
  },
  // db/client.ts talks to Postgres directly via drizzle-orm/postgres-js — both
  // need to run as real Node modules, not get bundled into the Edge/Turbopack
  // graph.
  serverExternalPackages: ["postgres", "drizzle-orm"],
  experimental: {
    optimizePackageImports: ["lucide-react", "@base-ui/react"],
  },
};

export default nextConfig;
