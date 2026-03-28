"use client";

import { useEffect } from "react";

const CACHE_KEY = "aleph_review_prefetch";
const TTL_MS = 45_000;

/**
 * Invisible component rendered on the dashboard.
 * Pre-fetches /api/cards/due + /api/settings into sessionStorage so the
 * review page can start rendering without waiting for network calls.
 */
export default function ReviewPrefetch() {
  useEffect(() => {
    try {
      const existing = sessionStorage.getItem(CACHE_KEY);
      if (existing) {
        const { ts } = JSON.parse(existing);
        if (Date.now() - ts < TTL_MS) return; // still fresh, skip
      }
    } catch {}

    Promise.all([
      fetch("/api/cards/due?limit=50").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/settings").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([cardsData, settingsData]) => {
        if (!cardsData || !settingsData) return;
        try {
          sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ cardsData, settingsData, ts: Date.now() })
          );
        } catch {}
      })
      .catch(() => {});
  }, []);

  return null;
}
