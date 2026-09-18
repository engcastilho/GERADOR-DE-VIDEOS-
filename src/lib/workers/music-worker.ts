import { Worker } from "bullmq";
import { MUSIC_QUEUE_NAME } from "@/lib/queues";
import { createRedisConnection } from "@/lib/redis";
import { runMusicGeneration } from "@/lib/generation/run-music-generation";

export function createMusicWorker() {
  return new Worker(
    MUSIC_QUEUE_NAME,
    async (job) => {
      await runMusicGeneration(job.data.musicGenerationId as string);
    },
    { connection: createRedisConnection(), concurrency: 2 }
  );
}
