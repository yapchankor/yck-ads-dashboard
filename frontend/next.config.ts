import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Defaults to ".next" (what Vercel expects) when NEXT_DIST_DIR is unset.
  // Lets multiple local dev servers (e.g. per-client previews) use isolated caches.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
