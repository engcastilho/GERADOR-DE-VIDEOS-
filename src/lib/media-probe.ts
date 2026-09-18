import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";

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
