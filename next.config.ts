import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Accounts saved by the server (password hashes) never go into a build output
  outputFileTracingExcludes: { "*": ["data/**"] },
};

export default nextConfig;
