import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Everything here is live booking data: render on request, no component caching.
  cacheComponents: false,
  serverExternalPackages: ["@libsql/client"],
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
