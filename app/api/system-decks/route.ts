/**
 * GET /api/system-decks
 *
 * Returns the list of available system decks with card counts.
 * Used by the System Decks browsing page.
 *
 * Response:
 *   { decks: SystemDeck[] }
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export type SystemDeck = {
  id: string;
  name: string;
  description: string;
  level: string | null;
  count: number;
};

const DECK_META: Record<string, { name: string; description: string; level: string | null }> = {
  A1: {
    name: "Hebrew Essentials — A1",
    description: "The 150 most common beginner words: greetings, numbers, family, food, daily life.",
    level: "A1",
  },
  A2: {
    name: "Hebrew Essentials — A2",
    description: "150 intermediate words: time, places, transport, emotions, work.",
    level: "A2",
  },
  B1: {
    name: "Hebrew Essentials — B1",
    description: "100 upper-intermediate words: abstract concepts, nuanced expressions.",
    level: "B1",
  },
  verbs: {
    name: "Top 100 Verbs",
    description: "The 100 most essential Hebrew verbs across all binyanim. With full conjugation tables.",
    level: null,
  },
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Count cards per system_deck in one query
  const { data: rows } = await supabase
    .from("system_cards")
    .select("system_deck")
    .not("system_deck", "is", null);

  const counts: Record<string, number> = {};
  for (const row of rows ?? []) {
    const key = row.system_deck as string;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const decks: SystemDeck[] = Object.entries(DECK_META)
    .filter(([id]) => (counts[id] ?? 0) > 0)
    .map(([id, meta]) => ({
      id,
      ...meta,
      count: counts[id] ?? 0,
    }));

  return NextResponse.json({ decks });
}
