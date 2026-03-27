import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Prevent Next.js from walking up to /Users/johnrosen and picking up the root package-lock.json
    root: path.resolve(__dirname),
    // Tailwind v4 uses `@import "tailwindcss"` in CSS — Turbopack resolves this
    // from the auto-detected workspace root (/Users/johnrosen) instead of this
    // project. Alias it explicitly to the local node_modules.
    resolveAlias: {
      tailwindcss: path.resolve(__dirname, "node_modules/tailwindcss"),
    },
  },
};

export default nextConfig;
