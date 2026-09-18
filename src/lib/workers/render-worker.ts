import { Worker } from "bullmq";
import { RENDER_QUEUE_NAME } from "@/lib/queues";
import { createRedisConnection } from "@/lib/redis";
import { runRender } from "@/lib/generation/run-render";

export function createRenderWorker() {
  return new Worker(
    RENDER_QUEUE_NAME,
    async (job) => {
      await runRender(job.data.renderJobId as string);
    },
    { connection: createRedisConnection(), concurrency: 1, lockDuration: 30 * 60 * 1000 }
  );
}
