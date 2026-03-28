/**
 * Shared helpers for card generation and saving.
 * Used by /api/cards and /api/cards/batch.
 */

import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";
import { CARD_GENERATION_SYSTEM } from "@/lib/prompts/card-generation";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type CardData = Record<string, unknown>;

/** Build the user message for card generation (shared by streaming and non-streaming). */
export function buildCardUserMessage(word: string, level: string, context?: string): string {
  const contextLine = context
    ? `\nContext sentence (the word appeared in this sentence — use it to disambiguate meaning): "${context}"`
    : "";
  return `Generate a vocabulary card for: "${word}" (target level: ${level})${contextLine}

IMPORTANT: If the input is an inflected or prefixed form (e.g. בתיק = ב + תיק, ילדים = plural of ילד, הלכתי = 1cs past of הלך), generate the card for the BASE/DICTIONARY form (תיק, ילד, הלך), not the inflected form. Always lemmatize first.`;
}

/** Call Claude Haiku to generate structured card data for a single word. */
export async function generateCardContent(word: string, level: string, context?: string): Promise<CardData> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: [
      {
        type: "text",
        text: CARD_GENERATION_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildCardUserMessage(word, level, context) }],
  });

  const raw = message.content
    .map((block) => ("text" in block ? block.text : ""))
    .join("");

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON object in response: ${raw.slice(0, 200)}`);
  return JSON.parse(jsonMatch[0]);
}

export type SavedCard = {
  id: string;
  hebrew: string;
  transliteration: string | null;
  english: string;
  example_sentence_he: string | null;
  example_sentence_transliteration: string | null;
  example_sentence_en: string | null;
  grammar_notes: string | null;
  word_type: string | null;
  grammar_info: Record<string, unknown> | null;
  tags: string[];
};

/**
 * Dedup-check then insert a card + FSRS state rows.
 * Returns { card, created: true } for new cards, { card, created: false } for existing.
 */
export async function saveCard(
  cardData: CardData,
  deckId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<{ card: SavedCard; created: boolean }> {
  const generatedEnglish = ((cardData.english as string) ?? "").toLowerCase().trim();
  const generatedHebrew = ((cardData.hebrew as string) ?? "").trim();

  const [{ data: byEnglish }, { data: byHebrew }] = await Promise.all([
    supabase
      .from("cards")
      .select("*")
      .eq("deck_id", deckId)
      .ilike("english", generatedEnglish)
      .limit(1),
    supabase
      .from("cards")
      .select("*")
      .eq("deck_id", deckId)
      .eq("hebrew", generatedHebrew)
      .limit(1),
  ]);

  const existing = byEnglish?.[0] ?? byHebrew?.[0] ?? null;
  if (existing) {
    return { card: existing as SavedCard, created: false };
  }

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .insert({
      deck_id: deckId,
      hebrew: cardData.hebrew,
      transliteration: cardData.transliteration ?? null,
      english: cardData.english,
      example_sentence_he: cardData.example_sentence_he ?? null,
      example_sentence_transliteration: cardData.example_sentence_transliteration ?? null,
      example_sentence_en: cardData.example_sentence_en ?? null,
      grammar_notes: cardData.grammar_notes ?? null,
      word_type: cardData.word_type ?? null,
      grammar_info: cardData.grammar_info ?? null,
      tags: cardData.tags ?? [],
    })
    .select()
    .single();

  if (cardError || !card) {
    throw new Error(`Failed to save card: ${cardError?.message}`);
  }

  const now = new Date().toISOString();
  await supabase.from("fsrs_state").insert([
    { user_id: userId, card_id: card.id, direction: "he_to_en", stability: 0, difficulty: 5, due: now, state: "new", reps: 0, lapses: 0 },
    { user_id: userId, card_id: card.id, direction: "en_to_he", stability: 0, difficulty: 5, due: now, state: "new", reps: 0, lapses: 0 },
  ]);

  return { card: card as SavedCard, created: true };
}

/**
 * Count how many cards this user has created today (UTC day).
 * Used to enforce daily_card_limit.
 */
export async function countCardsCreatedToday(
  userId: string,
  supabase: SupabaseClient
): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // Cards are owned via fsrs_state (user_id) + card created_at
  const { count } = await supabase
    .from("fsrs_state")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("direction", "he_to_en") // one row per card per direction — count only one direction
    .gte("created_at", todayStart.toISOString());

  return count ?? 0;
}

/** Get or create the user's personal "My Vocabulary" deck. Returns deckId. */
export async function getOrCreateDeck(
  userId: string,
  organizationId: string,
  level: string,
  supabase: SupabaseClient
): Promise<string> {
  const { data: existingDeck } = await supabase
    .from("decks")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("created_by", userId)
    .eq("name", "My Vocabulary")
    .maybeSingle();

  if (existingDeck) return existingDeck.id;

  const { data: newDeck, error } = await supabase
    .from("decks")
    .insert({
      organization_id: organizationId,
      created_by: userId,
      name: "My Vocabulary",
      level,
      is_system: false,
    })
    .select("id")
    .single();

  if (error || !newDeck) throw new Error("Failed to create deck");
  return newDeck.id;
}
