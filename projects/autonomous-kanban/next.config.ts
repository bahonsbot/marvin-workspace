import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Base path for GitHub Pages deployment at /autonomous-kanban
  basePath: process.env.GITHUB_PAGES === "true" ? "/marvin-workspace/autonomous-kanban" : "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
