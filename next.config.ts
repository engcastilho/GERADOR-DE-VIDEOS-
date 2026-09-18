import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages resolve native binaries relative to __dirname at
  // runtime; bundling them (Turbopack/webpack) corrupts that path, so keep
  // them as plain `require()`s in the server runtime instead.
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static", "fluent-ffmpeg"],
  // Belt-and-suspenders for Vercel: the ffmpeg/ffprobe binaries are only
  // ever reached via a runtime string path (spawn), not a static
  // require/import, so Vercel's file-tracing can miss them when deciding
  // what to ship in the /api/media serverless function.
  outputFileTracingIncludes: {
    "/api/media": [
      "./node_modules/ffmpeg-static/**",
      "./node_modules/ffprobe-static/**",
    ],
  },
};

export default nextConfig;
