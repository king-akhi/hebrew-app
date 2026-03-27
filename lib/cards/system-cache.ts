/**
 * System card cache — global shared vocabulary store.
 *
 * Before calling Haiku to generate a card, check system_cards first.
 * After a new generation, write back so future users skip the API call.
 *
 * Rules:
 * - One canonical card per English word (UNIQUE constraint on lower(english))
 * - User edits never touch system_cards (they only affect the personal cards table)
 * - Write-back is fire-and-forget: failures are silently swallowed
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type { CardData } from "./generate";

/** Normalize a word for cache lookup: lowercase, trim, strip leading "to ". */
function normalizeEnglish(word: string): string {
  return word.toLowerCase().trim().replace(/^to\s+/, "");
}

/**
 * Look up a word in the system cache.
 * Tries the word as-is and without a leading "to " prefix.
 * Returns CardData if found, null otherwise.
 */
export async function checkSystemCache(
  word: string,
  supabase: SupabaseClient
): Promise<CardData | null> {
  const normalized = normalizeEnglish(word);
  const original = word.toLowerCase().trim();

  const candidates = Array.from(new Set([normalized, original]));

  for (const candidate of candidates) {
    const { data } = await supabase
      .from("system_cards")
      .select("*")
      .ilike("english", candidate)
      .maybeSingle();

    if (data) return data as CardData;
  }

  return null;
}

/**
 * Write a freshly generated card to the system cache.
 * Uses upsert with ignoreDuplicates so existing entries are never overwritten.
 * Fire-and-forget — callers should not await this.
 */
export async function saveToSystemCache(
  cardData: CardData,
  level: string,
  systemDeck: string | null,
  supabase: SupabaseClient
): Promise<void> {
  const english = ((cardData.english as string) ?? "").toLowerCase().trim();
  if (!english) return;

  await supabase.from("system_cards").upsert(
    {
      hebrew: cardData.hebrew,
      transliteration: cardData.transliteration ?? null,
      english,
      example_sentence_he: cardData.example_sentence_he ?? null,
      example_sentence_en: cardData.example_sentence_en ?? null,
      grammar_notes: cardData.grammar_notes ?? null,
      word_type: cardData.word_type ?? null,
      grammar_info: cardData.grammar_info ?? null,
      tags: cardData.tags ?? [],
      level,
      system_deck: systemDeck,
    },
    { onConflict: "english", ignoreDuplicates: true }
  );
}
