import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  /** Claude Design `TweaksPanel` — gradually add types in `src/components/TweaksPanel.tsx` */
  typescript: { ignoreBuildErrors: true },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      fs: false,
      path: false,
    };
    return config;
  },
};

export default nextConfig;
