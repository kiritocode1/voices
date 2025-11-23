import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["onnxruntime-node"],
  outputFileTracingIncludes: {
    "/api/tts": ["./model/**/*"],
  },
};

export default nextConfig;
