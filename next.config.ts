import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Everything here is live booking data: render on request, no component caching.
  cacheComponents: false,
  serverExternalPackages: ["@libsql/client"],
  // Ship the seeded demo database with every server function (serverless fallback).
  outputFileTracingIncludes: { "/**": ["./seed/show.db"] },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
