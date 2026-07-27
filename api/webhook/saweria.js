// api/webhook/saweria.js
// Receives Saweria donation webhooks.
//
// Set this URL in Saweria dashboard -> Integrasi -> Webhook / Callback URL:
//   https://donasi-kamu.vercel.app/api/webhook/saweria
//
// Saweria sends a body shaped roughly like:
// {
//   "version": "2022.01",
//   "created_at": "2021-01-01T12:00:00+00:00",
//   "id": "00000000-0000-0000-0000-000000000000",
//   "type": "donation",
//   "amount_raw": 69420,
//   "cut": 3471,
//   "donator_name": "Someguy",
//   "donator_email": "someguy@example.com",
//   "message": "..."
// }
//
// Optional but recommended: verify the "Saweria-Callback-Signature" header
// using your Saweria Stream Key (HMAC). Uncomment verifySignature() below
// once you've set SAWERIA_STREAM_KEY in your Vercel env vars.

import crypto from "node:crypto";
import { pushDonation } from "../../lib/store.js";

function verifySignature(req, rawBody) {
  const streamKey = process.env.SAWERIA_STREAM_KEY;
  if (!streamKey) return true; // skip verification if not configured

  const signature = req.headers["saweria-callback-signature"];
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", streamKey)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  const rawBody = JSON.stringify(req.body || {});

  if (!verifySignature(req, rawBody)) {
    res.status(401).json({ success: false, error: "Invalid signature" });
    return;
  }

  const body = req.body || {};

  const donation = {
    id: body.id || crypto.randomUUID(),
    nama: body.donator_name || "Anonim",
    amount: Number(body.amount_raw ?? body.amount ?? 0),
    message: body.message || "",
    email: body.donator_email || "",
    timestamp: body.created_at || new Date().toISOString(),
    platform: "Saweria",
  };

  await pushDonation(donation);

  res.status(200).json({ success: true });
}
