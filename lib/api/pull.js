// api/pull.js
import { pullDonations } from "../lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 25);

    const items = await pullDonations(limit);
    res.status(200).json({ ok: true, items });
  } catch (err) {
    console.error("Error pulling donations:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
}
