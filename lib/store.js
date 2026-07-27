import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const QUEUE_KEY = "donations:pending";

export async function pushDonation(donation) {
  await redis.rpush(QUEUE_KEY, JSON.stringify(donation));
}

export async function popAllDonations() {
  const len = await redis.llen(QUEUE_KEY);
  if (!len) return [];

  const raw = await redis.lrange(QUEUE_KEY, 0, len - 1);
  await redis.ltrim(QUEUE_KEY, len, -1);

  return raw
    .map((item) => {
      try {
        return typeof item === "string" ? JSON.parse(item) : item;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
