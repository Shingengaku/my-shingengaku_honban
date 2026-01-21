import type { NextConfig } from "next";

// @ts-expect-error NextConfig types might not include eslint yet in some versions
const nextConfig: NextConfig = {
  /* config options here */
  experimental: {},
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
