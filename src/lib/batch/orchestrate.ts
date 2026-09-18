import { prisma } from "@/lib/prisma";
import { musicQueue, renderQueue } from "@/lib/queues";
import type { MediaAsset, VoiceGender } from "@prisma/client";

export type BatchConfig = {
  mediaAssetIds: string[];
  secondsPerImage: number;
  shuffle: boolean;
};

export type MusicSpec = {
  title: string;
  lyrics: string;
  style: string;
  voiceGender: VoiceGender;
  instrumental: boolean;
};

export function parseBatchConfig(config: string): BatchConfig {
  return JSON.parse(config) as BatchConfig;
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Cycles through the media pool building timeline items until their
 * durations cover `targetDurationSec` (the audio track length), trimming
 * only the final item so the total matches exactly.
 */
export function buildTimelineItemsForDuration(
  pool: MediaAsset[],
  targetDurationSec: number,
  secondsPerImage: number,
  shuffle: boolean
) {
  if (pool.length === 0) {
    throw new Error("Pool de mídia vazio: adicione imagens ou vídeos ao lote.");
  }

  const ordered = shuffle ? shuffleArray(pool) : pool;
  const items: {
    order: number;
    mediaAssetId: string;
    durationSec: number;
    trimStartSec: number;
  }[] = [];

  let remaining = targetDurationSec;
  let cursor = 0;

  while (remaining > 0.05) {
    const asset = ordered[cursor % ordered.length];
    const naturalDuration =
      asset.type === "IMAGE" ? secondsPerImage : Math.max(asset.durationSec ?? secondsPerImage, 0.5);
    const durationSec = Math.min(naturalDuration, remaining);

    items.push({
      order: items.length,
      mediaAssetId: asset.id,
      durationSec,
      trimStartSec: 0,
    });

    remaining -= durationSec;
    cursor += 1;

    if (items.length > 500) break; // safety valve against pathological configs
  }

  return items;
}

/**
 * Called after a MusicGeneration finishes (success or failure). If it
 * belongs to a batch, this advances the batch item: on success it builds a
 * Project timeline from the batch's media pool sized to the track's
 * duration and enqueues a render job; on failure it just marks the item.
 */
export async function onMusicGenerationSettled(musicGenerationId: string) {
  const batchItem = await prisma.batchItem.findUnique({
    where: { musicGenerationId },
    include: { batchJob: true },
  });
  if (!batchItem) return;

  const generation = await prisma.musicGeneration.findUnique({
    where: { id: musicGenerationId },
    include: { resultAsset: true },
  });
  if (!generation) return;

  if (generation.status === "FAILED" || !generation.resultAsset) {
    await prisma.batchItem.update({
      where: { id: batchItem.id },
      data: { status: "FAILED", errorMessage: generation.errorMessage ?? "Geração de música falhou" },
    });
    return;
  }

  try {
    const config = parseBatchConfig(batchItem.batchJob.config);
    const pool = await prisma.mediaAsset.findMany({
      where: { id: { in: config.mediaAssetIds } },
    });

    const items = buildTimelineItemsForDuration(
      pool,
      generation.resultAsset.durationSec ?? 30,
      config.secondsPerImage,
      config.shuffle
    );

    const project = await prisma.project.create({
      data: {
        name: generation.title || `Lote ${batchItem.batchJobId} #${batchItem.index + 1}`,
        audioTrackId: generation.resultAssetId,
        items: { create: items },
      },
    });

    const renderJob = await prisma.renderJob.create({
      data: { projectId: project.id, status: "QUEUED" },
    });

    await prisma.batchItem.update({
      where: { id: batchItem.id },
      data: { status: "COMPLETED", projectId: project.id },
    });

    await renderQueue.add("render", { renderJobId: renderJob.id });
  } catch (err) {
    await prisma.batchItem.update({
      where: { id: batchItem.id },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

export async function createBatchJob(input: {
  name: string;
  specs: MusicSpec[];
  mediaAssetIds: string[];
  secondsPerImage: number;
  shuffle: boolean;
}) {
  const config: BatchConfig = {
    mediaAssetIds: input.mediaAssetIds,
    secondsPerImage: input.secondsPerImage,
    shuffle: input.shuffle,
  };

  const batchJob = await prisma.batchJob.create({
    data: {
      name: input.name,
      config: JSON.stringify(config),
      status: "PROCESSING",
    },
  });

  for (let i = 0; i < input.specs.length; i++) {
    const spec = input.specs[i];
    const generation = await prisma.musicGeneration.create({
      data: {
        title: spec.title,
        lyrics: spec.lyrics,
        style: spec.style,
        voiceGender: spec.voiceGender,
        instrumental: spec.instrumental,
        provider: process.env.MUSIC_PROVIDER ?? "mock",
        status: "PENDING",
      },
    });

    await prisma.batchItem.create({
      data: {
        batchJobId: batchJob.id,
        index: i,
        musicGenerationId: generation.id,
        status: "PROCESSING",
      },
    });

    await musicQueue.add("generate", { musicGenerationId: generation.id });
  }

  return batchJob;
}
