import { Redis } from "ioredis";

/**
 * Redis connection suitable for BullMQ (blocking commands require maxRetriesPerRequest: null).
 * Uses REDIS_HOST / REDIS_PORT with localhost:6379 defaults.
 */
export function createConnection(): Redis {
  const host = process.env["REDIS_HOST"] ?? "localhost";
  const port = parseInt(process.env["REDIS_PORT"] ?? "6379", 10);

  return new Redis({
    host,
    port,
    maxRetriesPerRequest: null
  });
}
