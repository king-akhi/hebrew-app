/**
 * GET /api/system-decks/preview?deck=A1&offset=0&limit=30
 *
 * Returns the next N system cards not yet owned by the user.
 * Used to show a preview before confirming import.
 *
 * Response:
 *   { cards: PreviewCard[]; total_remaining: number }
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export type PreviewCard = {
  id: string;
  hebrew: string;
  transliteration: string | null;
  english: string;
  word_type: string | null;
};

const VALID_DECKS = ["A1", "A2", "B1", "verbs"];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deck = request.nextUrl.searchParams.get("deck");
  const offset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0", 10);
  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "30", 10);

  if (!deck || !VALID_DECKS.includes(deck)) {
    return NextResponse.json({ error: "Invalid deck" }, { status: 400 });
  }

  // Get all system cards for this deck
  const { data: systemCards } = await supabase
    .from("system_cards")
    .select("id, hebrew, transliteration, english, word_type")
    .eq("system_deck", deck)
    .order("created_at");

  if (!systemCards) return NextResponse.json({ cards: [], total_remaining: 0 });

  // Get user's existing card english values
  const { data: profile } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  const existingEnglish = new Set<string>();
  if (profile) {
    const { data: userDecks } = await supabase
      .from("decks")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("is_system", false);

    if (userDecks?.length) {
      const deckIds = userDecks.map((d) => d.id);
      const { data: userCards } = await supabase
        .from("cards")
        .select("english")
        .in("deck_id", deckIds);
      (userCards ?? []).forEach((c) => existingEnglish.add(c.english.toLowerCase()));
    }
  }

  // Filter out already-owned cards
  const available = systemCards.filter(
    (sc) => !existingEnglish.has(sc.english.toLowerCase())
  );

  const page = available.slice(offset, offset + limit);
  const total_remaining = available.length;

  return NextResponse.json({ cards: page, total_remaining });
}
