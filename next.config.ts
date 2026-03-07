import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    minimumCacheTTL: 2678400, // 31 days
    formats: ["image/webp"],
    deviceSizes: [640, 828, 1200],
    imageSizes: [32, 64, 128, 256],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.openfoodfacts.org",
      },
    ],
  },
};

export default nextConfig;