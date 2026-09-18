import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { writeFile, unlink } from "fs/promises";

ffmpeg.setFfmpegPath(ffmpegPath as unknown as string);
ffmpeg.setFfprobePath(ffprobePath.path);

export type MediaProbeResult = {
  durationSec?: number;
  width?: number;
  height?: number;
};

export async function probeMedia(filePath: string): Promise<MediaProbeResult> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        console.error(`[probeMedia] ffprobe falhou para ${filePath}:`, err.message);
        resolve({});
        return;
      }
      const videoStream = data.streams.find((s) => s.codec_type === "video");
      resolve({
        durationSec: typeof data.format.duration === "number" ? data.format.duration : undefined,
        width: videoStream?.width ?? undefined,
        height: videoStream?.height ?? undefined,
      });
    });
  });
}

/**
 * Probes a buffer that hasn't been persisted yet (or was persisted to a
 * remote store like Vercel Blob, which ffprobe can't read directly) by
 * writing it to a local temp file first — /tmp is writable even on Vercel's
 * serverless filesystem.
 */
export async function probeBuffer(buffer: Buffer, extension: string): Promise<MediaProbeResult> {
  const tmpPath = path.join(os.tmpdir(), `probe-${randomUUID()}${extension}`);
  await writeFile(tmpPath, buffer);
  try {
    return await probeMedia(tmpPath);
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}
