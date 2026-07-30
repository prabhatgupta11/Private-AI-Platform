import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "*.proxy.runpod.net",
    "*.runpod.net",
    "localhost:3000",
  ],
};

export default nextConfig;
