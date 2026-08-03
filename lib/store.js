// lib/store.js
// Shared donation queue, backed by Upstash Redis (installed via Vercel Marketplace).
//
// Two consumption modes are supported:
//  1. Simple mode (used by /api/donations + the SociaBuzz-style Roblox script):
//     pushDonation() / popAllDonations() — just grab everything, no leasing.
//  2. Lease mode (used by /api/pull + /api/ack + the CenzDonateReal-style script):
//     pullDonations() hands out a batch with a leaseToken each; the Roblox
//     server must ackDonations() them as done/failed. Unacked leases expire
//     and get put back on the queue automatically, so a crashed/duplicate
//     Roblox server can never lose or double-spend a donation.

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const QUEUE_KEY = "donations:pending";
const LEASE_HASH_KEY = "donations:leases:data";
const LEASE_ZSET_KEY = "donations:leases:expiry";
const LEASE_TTL_MS = 60_000; // 60s to record + ack before it's considered abandoned

function parseItem(raw) {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

export async function pushDonation(donation) {
  await redis.rpush(QUEUE_KEY, JSON.stringify(donation));
}

export async function popAllDonations() {
  const len = await redis.llen(QUEUE_KEY);
  if (!len) return [];

  const raw = await redis.lrange(QUEUE_KEY, 0, len - 1);
  await redis.ltrim(QUEUE_KEY, len, -1);

  return raw.map(parseItem).filter(Boolean);
}

async function reclaimExpiredLeases() {
  const now = Date.now();
  const expiredIds = await redis.zrange(LEASE_ZSET_KEY, 0, now, { byScore: true });
  if (!expiredIds || expiredIds.length === 0) return;

  for (const id of expiredIds) {
    const raw = await redis.hget(LEASE_HASH_KEY, id);
    const lease = parseItem(raw);
    if (lease?.item) {
      await redis.rpush(QUEUE_KEY, JSON.stringify(lease.item));
    }
    await redis.hdel(LEASE_HASH_KEY, id);
    await redis.zrem(LEASE_ZSET_KEY, id);
  }
}

export async function pullDonations(limit = 10) {
  await reclaimExpiredLeases();

  const items = [];
  for (let i = 0; i < limit; i++) {
    const raw = await redis.lpop(QUEUE_KEY);
    if (!raw) break;
    const item = parseItem(raw);
    if (!item) continue;

    const leaseToken = crypto.randomUUID();
    await redis.hset(LEASE_HASH_KEY, {
      [item.id]: JSON.stringify({ item, leaseToken }),
    });
    await redis.zadd(LEASE_ZSET_KEY, { score: Date.now() + LEASE_TTL_MS, member: item.id });

    items.push({
      id: item.id,
      donator_name: item.nama,
      amount_raw: item.amount,
      message: item.message,
      createdAt: item.timestamp,
      platform: item.platform,
      leaseToken,
    });
  }
  return items;
}

export async function ackDonations(acks) {
  for (const ack of acks || []) {
    const raw = await redis.hget(LEASE_HASH_KEY, ack.id);
    const lease = parseItem(raw);
    if (!lease) continue;
    if (lease.leaseToken !== ack.leaseToken) continue;

    if (ack.status !== "done" && lease.item) {
      await redis.rpush(QUEUE_KEY, JSON.stringify(lease.item));
    }
    await redis.hdel(LEASE_HASH_KEY, ack.id);
    await redis.zrem(LEASE_ZSET_KEY, ack.id);
  }
}
