import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  output: "export",
  turbopack: { root: process.cwd() },
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "firebasestorage.googleapis.com" }],
  },
  trailingSlash: true,
};

export default nextConfig;
