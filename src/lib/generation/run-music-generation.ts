import { prisma } from "@/lib/prisma";
import { getMusicProvider } from "@/lib/music";
import { extensionFromMime, saveBuffer } from "@/lib/storage";
import { probeBuffer } from "@/lib/media-probe";
import { onMusicGenerationSettled } from "@/lib/batch/orchestrate";

const POLL_INTERVAL_MS = 5000;
const TIMEOUT_MS = Number(process.env.MUSIC_GENERATION_TIMEOUT_MS ?? 15 * 60 * 1000);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runMusicGeneration(musicGenerationId: string) {
  const generation = await prisma.musicGeneration.findUnique({
    where: { id: musicGenerationId },
  });
  if (!generation) return;

  const provider = getMusicProvider();

  try {
    let providerJobId = generation.providerJobId;

    if (!providerJobId) {
      const { providerJobId: startedJobId } = await provider.start({
        title: generation.title,
        lyrics: generation.lyrics,
        style: generation.style,
        voiceGender: generation.voiceGender,
        instrumental: generation.instrumental,
      });
      providerJobId = startedJobId;
      await prisma.musicGeneration.update({
        where: { id: musicGenerationId },
        data: { providerJobId, status: "PROCESSING", provider: provider.name },
      });
    }

    const deadline = Date.now() + TIMEOUT_MS;
    while (Date.now() < deadline) {
      const result = await provider.checkStatus(providerJobId);

      if (result.status === "PROCESSING") {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      if (result.status === "FAILED") {
        await prisma.musicGeneration.update({
          where: { id: musicGenerationId },
          data: { status: "FAILED", errorMessage: result.error },
        });
        await onMusicGenerationSettled(musicGenerationId);
        return;
      }

      // COMPLETED
      let storageKey = result.localStorageKey;
      let durationSec = result.durationSec;
      let sizeBytes = result.sizeBytes;

      if (!storageKey) {
        if (!result.audioUrl) {
          throw new Error("Provider retornou COMPLETED sem audioUrl nem localStorageKey");
        }
        const res = await fetch(result.audioUrl);
        if (!res.ok) {
          throw new Error(`Falha ao baixar áudio gerado (${res.status})`);
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get("content-type") ?? "audio/mpeg";
        const extension = extensionFromMime(contentType) || ".mp3";
        sizeBytes = buffer.length;

        if (!durationSec) {
          const probe = await probeBuffer(buffer, extension);
          durationSec = probe.durationSec;
        }

        storageKey = await saveBuffer(buffer, extension);
      }

      const asset = await prisma.mediaAsset.create({
        data: {
          type: "AUDIO",
          source: "GENERATED_MUSIC",
          filename: `${generation.title || "musica"}.mp3`,
          storageKey,
          mimeType: "audio/mpeg",
          sizeBytes: sizeBytes ?? 0,
          durationSec,
        },
      });

      await prisma.musicGeneration.update({
        where: { id: musicGenerationId },
        data: { status: "COMPLETED", resultAssetId: asset.id },
      });
      await onMusicGenerationSettled(musicGenerationId);
      return;
    }

    await prisma.musicGeneration.update({
      where: { id: musicGenerationId },
      data: { status: "FAILED", errorMessage: "Tempo limite excedido aguardando a geração" },
    });
    await onMusicGenerationSettled(musicGenerationId);
  } catch (err) {
    await prisma.musicGeneration.update({
      where: { id: musicGenerationId },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    await onMusicGenerationSettled(musicGenerationId);
  }
}
