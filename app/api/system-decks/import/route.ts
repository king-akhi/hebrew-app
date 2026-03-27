/**
 * POST /api/system-decks/import
 *
 * Imports all cards from a system deck into the user's personal deck.
 * Skips cards the user already has (dedup by english + hebrew).
 *
 * Request body:
 *   { deck: "A1" | "A2" | "B1" | "verbs" }
 *
 * Response:
 *   { imported: number; skipped: number }
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { saveCard, getOrCreateDeck, countCardsCreatedToday } from "@/lib/cards/generate";
import type { CardData } from "@/lib/cards/generate";

const DEFAULT_DAILY_LIMIT = 20;

const VALID_DECKS = ["A1", "A2", "B1", "verbs"] as const;
type DeckId = (typeof VALID_DECKS)[number];

const DECK_LEVEL: Record<DeckId, string> = {
  A1: "A1",
  A2: "A2",
  B1: "B1",
  verbs: "A1", // mixed — use A1 as the deck level for verbs
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { deck: string; card_ids: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!VALID_DECKS.includes(body.deck as DeckId)) {
    return NextResponse.json({ error: "Invalid deck id" }, { status: 400 });
  }
  if (!Array.isArray(body.card_ids) || body.card_ids.length === 0) {
    return NextResponse.json({ error: "card_ids required" }, { status: 400 });
  }
  const deckId = body.deck as DeckId;

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id, daily_card_limit")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "User profile not found" }, { status: 404 });

  // Enforce daily card limit
  const dailyLimit = (profile as unknown as { daily_card_limit?: number }).daily_card_limit ?? DEFAULT_DAILY_LIMIT;
  const createdToday = await countCardsCreatedToday(user.id, supabase);
  const remaining = dailyLimit - createdToday;
  if (remaining <= 0) {
    return NextResponse.json(
      { error: "daily_limit_reached", limit: dailyLimit, created_today: createdToday },
      { status: 429 }
    );
  }
  // Cap import to remaining capacity
  const cappedIds = body.card_ids.slice(0, remaining);

  // Fetch only the requested system cards
  const { data: systemCards, error } = await supabase
    .from("system_cards")
    .select("*")
    .in("id", cappedIds);

  if (error || !systemCards) {
    return NextResponse.json({ error: "Failed to fetch system cards" }, { status: 500 });
  }

  const personalDeckId = await getOrCreateDeck(
    user.id,
    profile.organization_id,
    DECK_LEVEL[deckId],
    supabase
  );

  let imported = 0;
  let skipped = 0;

  // Import in batches of 10 to avoid overwhelming the DB
  const BATCH = 10;
  for (let i = 0; i < systemCards.length; i += BATCH) {
    const batch = systemCards.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (sc) => {
        try {
          const { created } = await saveCard(sc as CardData, personalDeckId, user.id, supabase);
          if (created) imported++;
          else skipped++;
        } catch {
          skipped++;
        }
      })
    );
  }

  return NextResponse.json({ imported, skipped });
}
