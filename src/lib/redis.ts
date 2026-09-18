import IORedis from "ioredis";

// Different "add Redis" flows on Vercel name the connection string
// differently (Upstash's own integration uses REDIS_URL, but Vercel's
// Marketplace/KV-branded flow can inject KV_URL instead) — accept either so
// wiring up the integration doesn't also require renaming its env var.
function redisUrl() {
  return process.env.REDIS_URL ?? process.env.KV_URL ?? "redis://127.0.0.1:6379";
}

/**
 * Returns a fresh ioredis connection. Each BullMQ Queue/Worker should get
 * its own instance instead of sharing one — Workers issue blocking commands
 * that would otherwise stall other consumers on a shared connection.
 */
export function createRedisConnection() {
  return new IORedis(redisUrl(), { maxRetriesPerRequest: null });
}
