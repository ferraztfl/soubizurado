import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Exam uploads (booklet + answer key PDFs) go through a Server
    // Action. Both limits must cover them: the proxy buffers request
    // bodies and silently truncates above its limit (default 10MB).
    serverActions: {
      bodySizeLimit: "40mb",
    },
    proxyClientMaxBodySize: "40mb",
  },
};

export default nextConfig;
