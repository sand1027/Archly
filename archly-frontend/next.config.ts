import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a standalone build for Docker — only required files are copied
  // into the final image, making it ~160 MB instead of 1 GB+.
  output: "standalone",

  // Excalidraw and mermaid-to-excalidraw are ESM packages — must be transpiled
  transpilePackages: [
    "@excalidraw/excalidraw",
    "@excalidraw/mermaid-to-excalidraw",
    "@xyflow/react",
  ],

  // Allow canvas images from the Excalidraw CDN
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "excalidraw.nyc3.cdn.digitaloceanspaces.com",
      },
    ],
  },

  // Silence the "no turbopack config" error — Turbopack is used by default
  // in Next.js 16. We don't need custom webpack config; Excalidraw works
  // fine under Turbopack with transpilePackages alone.
  turbopack: {},
};

export default nextConfig;
