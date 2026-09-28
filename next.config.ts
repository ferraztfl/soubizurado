import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Public, search-friendly addresses of the question bank (same pages as /app/questoes).
  async rewrites() {
    return [
      { source: "/questoes", destination: "/app/questoes" },
      { source: "/questoes/:questionId", destination: "/app/questoes/:questionId" },
    ];
  },
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
