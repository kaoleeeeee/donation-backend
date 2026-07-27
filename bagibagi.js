// api/webhook/bagibagi.js
// Receives Bagibagi.co donation webhooks.
//
// Set this URL in Bagibagi -> Stream Overlay -> Integrasi -> Custom Webhook Url:
//   https://donasi-kamu.vercel.app/api/webhook/bagibagi
//
// Bagibagi sends a body roughly like:
// { "name": "Someguy", "amount": 10000, "message": "..." }
//
// Optional but recommended: verify the "X-Bagibagi-Signature" header,
// which is an HMAC-SHA256 of the raw JSON body using your Webhook Token
// (found in Bagibagi -> Integrasi tab). Set BAGIBAGI_WEBHOOK_TOKEN in
// your Vercel env vars to enable verification.

import crypto from "node:crypto";
import { pushDonation } from "../../lib/store.js";

function verifySignature(req, rawBody) {
  const token = process.env.BAGIBAGI_WEBHOOK_TOKEN;
  if (!token) return true; // skip verification if not configured

  const signature = req.headers["x-bagibagi-signature"];
  if (!signature) return false;

  const expected = crypto.createHmac("sha256", token).update(rawBody).digest("hex");

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
    nama: body.name || body.nama || "Anonim",
    amount: Number(body.amount ?? 0),
    message: body.message || "",
    email: body.email || "",
    timestamp: new Date().toISOString(),
    platform: "Bagibagi",
  };

  await pushDonation(donation);

  res.status(200).json({ success: true });
}
