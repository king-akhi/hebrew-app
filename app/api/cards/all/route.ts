/**
 * GET /api/cards/all
 *
 * Returns all vocabulary cards for the authenticated user,
 * with aggregated FSRS stats (total reps across both directions).
 *
 * Response: { cards: VocabCard[] }
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all fsrs_state rows for the user (both directions per card)
  const { data, error } = await supabase
    .from("fsrs_state")
    .select(`
      card_id,
      direction,
      reps,
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
    .order("card_id");

  if (error) {
    console.error("[cards/all] Error:", error);
    return NextResponse.json({ error: "Failed to fetch cards" }, { status: 500 });
  }

  // Deduplicate by card_id — merge both directions into one entry
  const byCardId = new Map<string, {
    card_id: string;
    total_reps: number;
    state: string;
    hebrew: string;
    transliteration: string | null;
    english: string;
    example_sentence_he: string | null;
    example_sentence_en: string | null;
    grammar_notes: string | null;
    word_type: string | null;
    grammar_info: Record<string, unknown> | null;
    user_notes: string | null;
    tags: string[];
  }>();

  for (const row of data ?? []) {
    if (!row.cards) continue;
    const c = row.cards as unknown as {
      id: string; hebrew: string; transliteration: string | null;
      english: string; example_sentence_he: string | null;
      example_sentence_en: string | null; grammar_notes: string | null;
      word_type: string | null; grammar_info: Record<string, unknown> | null;
      user_notes: string | null; tags: string[];
    };

    const existing = byCardId.get(row.card_id);
    if (existing) {
      existing.total_reps += row.reps ?? 0;
      // Prefer "review" state over "learning" over "new"
      const stateRank = (s: string) => s === "review" ? 2 : s === "learning" ? 1 : 0;
      if (stateRank(row.state ?? "new") > stateRank(existing.state)) {
        existing.state = row.state ?? "new";
      }
    } else {
      byCardId.set(row.card_id, {
        card_id: row.card_id,
        total_reps: row.reps ?? 0,
        state: row.state ?? "new",
        hebrew: c.hebrew,
        transliteration: c.transliteration,
        english: c.english,
        example_sentence_he: c.example_sentence_he,
        example_sentence_en: c.example_sentence_en,
        grammar_notes: c.grammar_notes,
        word_type: c.word_type ?? null,
        grammar_info: c.grammar_info ?? null,
        user_notes: c.user_notes,
        tags: c.tags ?? [],
      });
    }
  }

  const cards = Array.from(byCardId.values()).sort((a, b) =>
    a.english.localeCompare(b.english)
  );

  return NextResponse.json({ cards });
}
