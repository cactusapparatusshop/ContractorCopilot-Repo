import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The self-contained Node server is needed only by the Docker image. Keeping
  // it out of normal builds also avoids Windows symlink restrictions and lets
  // Vercel use its native Next.js runtime.
  ...(process.env.DOCKER_BUILD === "true" ? { output: "standalone" } : {}),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
};

export default nextConfig;
