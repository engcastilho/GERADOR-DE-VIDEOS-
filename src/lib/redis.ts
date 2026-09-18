import IORedis from "ioredis";

/**
 * Returns a fresh ioredis connection. Each BullMQ Queue/Worker should get
 * its own instance instead of sharing one — Workers issue blocking commands
 * that would otherwise stall other consumers on a shared connection.
 */
export function createRedisConnection() {
  return new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: null,
  });
}
