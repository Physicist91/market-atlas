import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "ais-dev-uettxnd2th2dze2bssvmyz-864047732290.asia-southeast1.run.app",
    "ais-pre-uettxnd2th2dze2bssvmyz-864047732290.asia-southeast1.run.app",
    "*.run.app",
    "*.google.com",
    "localhost:3000",
    "localhost:8080",
  ],
};

export default nextConfig;

