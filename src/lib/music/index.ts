import type { MusicProvider } from "./types";
import { MockMusicProvider } from "./providers/mock";
import { SunoApiProvider } from "./providers/sunoApi";

export * from "./types";

let cached: MusicProvider | null = null;

export function getMusicProvider(): MusicProvider {
  if (cached) return cached;

  const providerName = process.env.MUSIC_PROVIDER ?? "mock";

  if (providerName === "suno-api") {
    cached = new SunoApiProvider();
  } else {
    cached = new MockMusicProvider();
  }

  return cached;
}
