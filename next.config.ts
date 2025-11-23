import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["onnxruntime-node"],
  outputFileTracingIncludes: {
    "/api/tts": ["./model/**/*"],
  },
};

export default nextConfig;
