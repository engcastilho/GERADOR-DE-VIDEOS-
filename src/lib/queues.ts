import { Queue } from "bullmq";
import { createRedisConnection } from "./redis";

const globalForQueues = globalThis as unknown as {
  musicQueue?: Queue;
  renderQueue?: Queue;
};

export const MUSIC_QUEUE_NAME = "music-generation";
export const RENDER_QUEUE_NAME = "video-render";

export const musicQueue =
  globalForQueues.musicQueue ??
  new Queue(MUSIC_QUEUE_NAME, { connection: createRedisConnection() });

export const renderQueue =
  globalForQueues.renderQueue ??
  new Queue(RENDER_QUEUE_NAME, { connection: createRedisConnection() });

if (process.env.NODE_ENV !== "production") {
  globalForQueues.musicQueue = musicQueue;
  globalForQueues.renderQueue = renderQueue;
}
