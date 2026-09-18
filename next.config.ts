import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages resolve native binaries relative to __dirname at
  // runtime; bundling them (Turbopack/webpack) corrupts that path, so keep
  // them as plain `require()`s in the server runtime instead.
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static", "fluent-ffmpeg"],
};

export default nextConfig;
