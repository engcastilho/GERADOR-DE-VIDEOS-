import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { readFile, unlink } from "fs/promises";
import { saveBuffer } from "@/lib/storage";
import type {
  MusicGenParams,
  MusicGenStartResult,
  MusicGenStatusResult,
  MusicProvider,
} from "../types";

const execFileAsync = promisify(execFile);

const DURATION_SEC = 40;

/**
 * Generates a placeholder tone instead of calling a real music API.
 * Lets the whole pipeline (queue, timeline, render, batch) be exercised
 * end-to-end without API keys or cost while a real provider isn't configured.
 *
 * Shells out to the ffmpeg-static binary directly (not fluent-ffmpeg): its
 * format-availability check misparses the `-formats` output of newer ffmpeg
 * builds (which add a device-flag column) and wrongly rejects `lavfi`.
 */
export class MockMusicProvider implements MusicProvider {
  readonly name = "mock";

  async start(params: MusicGenParams): Promise<MusicGenStartResult> {
    const tmpPath = path.join(os.tmpdir(), `mock-music-${randomUUID()}.mp3`);
    const freq =
      params.voiceGender === "MALE" ? 220 : params.voiceGender === "FEMALE" ? 440 : 330;

    await execFileAsync(ffmpegPath as unknown as string, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${freq}:duration=${DURATION_SEC}`,
      "-ar",
      "44100",
      "-ac",
      "2",
      tmpPath,
    ]);

    const buffer = await readFile(tmpPath);
    const storageKey = await saveBuffer(buffer, ".mp3");
    await unlink(tmpPath).catch(() => {});

    // JSON-encoded (not colon-joined) since storageKey may be a full
    // https:// blob URL, which itself contains colons.
    const payload = { storageKey, durationSec: DURATION_SEC, sizeBytes: buffer.length };
    return { providerJobId: `mock:${JSON.stringify(payload)}` };
  }

  async checkStatus(providerJobId: string): Promise<MusicGenStatusResult> {
    try {
      const payload = JSON.parse(providerJobId.replace(/^mock:/, ""));
      return {
        status: "COMPLETED",
        localStorageKey: payload.storageKey,
        durationSec: payload.durationSec ?? DURATION_SEC,
        sizeBytes: payload.sizeBytes,
      };
    } catch {
      return { status: "FAILED", error: "Job de mock inválido" };
    }
  }
}
