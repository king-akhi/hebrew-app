/**
 * GET /api/cards/due?limit=20
 *
 * Returns cards due for review for the authenticated user,
 * ordered by due date ascending.
 *
 * Response:
 *   { cards: DueCard[] }
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(parseInt(limitParam ?? "20", 10) || 20, 100);

  const { data, error } = await supabase
    .from("fsrs_state")
    .select(`
      id,
      card_id,
      direction,
      stability,
      difficulty,
      due,
      last_review,
      reps,
      lapses,
      state,
      cards (
        id,
        hebrew,
        transliteration,
        english,
        example_sentence_he,
        example_sentence_en,
        grammar_notes,
        word_type,
        grammar_info,
        user_notes,
        tags
      )
    `)
    .eq("user_id", user.id)
    .lte("due", new Date().toISOString())
    .order("due", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[cards/due] Error:", error);
    return NextResponse.json({ error: "Failed to fetch due cards" }, { status: 500 });
  }

  // Flatten: merge fsrs_state fields with card fields
  const flat = (data ?? [])
    .filter((row) => row.cards !== null)
    .map((row) => ({
      fsrs_state_id: row.id,
      card_id: row.card_id,
      direction: row.direction ?? "he_to_en",
      stability: row.stability,
      difficulty: row.difficulty,
      due: row.due,
      last_review: row.last_review,
      reps: row.reps,
      lapses: row.lapses,
      state: row.state,
      ...(row.cards as unknown as Record<string, unknown>),
    }));

  // Interleave directions so HE→EN and EN→HE of the same card are as far apart
  // as possible. Group by card_id (preserving due-date order), then round-robin
  // across cards: all first directions first, then all second directions.
  const byCard = new Map<string, typeof flat>();
  for (const card of flat) {
    if (!byCard.has(card.card_id)) byCard.set(card.card_id, []);
    byCard.get(card.card_id)!.push(card);
  }
  const groups = [...byCard.values()];
  const maxDirs = Math.max(...groups.map((g) => g.length));
  const cards: typeof flat = [];
  for (let i = 0; i < maxDirs; i++) {
    for (const group of groups) {
      if (group[i]) cards.push(group[i]);
    }
  }

  return NextResponse.json({ cards });
}
