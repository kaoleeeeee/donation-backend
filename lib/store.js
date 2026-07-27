// lib/store.js
// Shared donation queue, backed by Vercel KV (Upstash Redis under the hood).
// Webhook handlers push new donations here; /api/donations pops & returns them.

import { kv } from "@vercel/kv";

const QUEUE_KEY = "donations:pending";

/**
 * Push a normalized donation object onto the pending queue.
 * @param {object} donation
 */
export async function pushDonation(donation) {
  await kv.rpush(QUEUE_KEY, JSON.stringify(donation));
}

/**
 * Pop ALL currently pending donations off the queue and return them.
 * Uses llen + ltrim so we only remove what we actually read,
 * avoiding a race with donations pushed in between.
 * @returns {Promise<object[]>}
 */
export async function popAllDonations() {
  const len = await kv.llen(QUEUE_KEY);
  if (!len) return [];

  const raw = await kv.lrange(QUEUE_KEY, 0, len - 1);

  // Remove only the items we just read (in case more got pushed meanwhile)
  await kv.ltrim(QUEUE_KEY, len, -1);

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
