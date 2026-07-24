import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This repo holds three independent Next apps (web/, website/, admin/),
  // each with its own lockfile. Pin the root here so Turbopack doesn't climb
  // to a sibling app's lockfile.
  turbopack: {
    root: __dirname,
  },
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [],
    rehypePlugins: [],
  },
});

export default withMDX(nextConfig);
