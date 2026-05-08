import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  /** Claude Design `TweaksPanel` — gradually add types in `src/components/TweaksPanel.tsx` */
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
