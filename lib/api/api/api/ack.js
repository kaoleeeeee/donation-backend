// api/ack.js
import { ackDonations } from "../lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];

    await ackDonations(items);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error acking donations:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
}
