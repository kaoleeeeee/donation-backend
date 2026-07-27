// api/donations.js
// Polled by the Roblox server script every few seconds.
// Returns all donations queued since the last poll, then clears the queue.

import { popAllDonations } from "../lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const donations = await popAllDonations();
    res.status(200).json({ success: true, donations });
  } catch (err) {
    console.error("Error fetching donations:", err);
    res.status(500).json({ success: false, error: "Internal error" });
  }
}
