import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "ais-dev-uettxnd2th2dze2bssvmyz-864047732290.asia-southeast1.run.app",
    "ais-pre-uettxnd2th2dze2bssvmyz-864047732290.asia-southeast1.run.app",
    "*.run.app",
    "*.asia-southeast1.run.app",
    "*.google.com",
    "*.googleusercontent.com",
    "*.aistudio.google.com",
    "localhost:3000",
    "localhost:8080",
    "127.0.0.1:3000",
    "0.0.0.0:3000"
  ],
};

export default nextConfig;

