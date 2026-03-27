/**
 * One-time seed script — populates system_cards with ~500 common words
 * and pre-generates conjugation_tables for the top 100 verbs.
 *
 * Run with:
 *   npx tsx scripts/seed-system-cards.ts
 *
 * Requires env vars:
 *   ANTHROPIC_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← bypasses RLS so we can write to system_cards
 *
 * Cost: ~$1.00 one-time (500 cards × $0.0016 + 100 conjugations × $0.002)
 * Duration: ~10-15 minutes (API rate limits + parallelism)
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { CARD_GENERATION_SYSTEM } from "../lib/prompts/card-generation";

// ── Config ────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing required env vars: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Deck definitions ──────────────────────────────────────────────────────────

const DECKS = [
  {
    id: "A1",
    level: "A1",
    prompt: `List the 150 most essential Modern Hebrew vocabulary words for absolute beginners (A1 level).
Cover: greetings & expressions, numbers 1-20, days/months, colors, family members, body parts, common foods, household items, basic verbs (to be, to have, to go, to eat, to drink, to sleep, to work), basic adjectives (big, small, good, bad, hot, cold, new, old).
Return ONLY a JSON array of English words/phrases. Prefer single words. For multi-word concepts (e.g. "dining room"), include them. For verbs, use the infinitive without "to" (e.g. "eat" not "to eat").
Example format: ["hello", "thank you", "yes", "no", "one", "two", "mother", "father", "water", "bread"]`,
    count: 150,
  },
  {
    id: "A2",
    level: "A2",
    prompt: `List 150 Hebrew vocabulary words for elementary learners (A2 level).
Cover: time expressions (yesterday, tomorrow, always, never, soon), places (restaurant, hospital, post office, gym), transport (bus, train, taxi, airport), shopping & money, emotions & feelings, weather & seasons, clothing & appearance, professions & work.
Avoid the most basic A1 words already covered (colors, numbers, basic family, greetings).
Return ONLY a JSON array of English words/phrases. For verbs, use the infinitive without "to".`,
    count: 150,
  },
  {
    id: "B1",
    level: "B1",
    prompt: `List 100 Hebrew vocabulary words for intermediate learners (B1 level).
Cover: abstract concepts (democracy, justice, responsibility, opportunity), nuanced emotions (disappointed, relieved, anxious, proud), complex social situations, culture & religion specific to Israeli life, business & economy terms, media & politics basics.
Return ONLY a JSON array of English words/phrases. For verbs, use the infinitive without "to".`,
    count: 100,
  },
  {
    id: "verbs",
    level: "A1",
    prompt: `List the 100 most important and frequently used verbs in Modern Israeli Hebrew, covering all major binyanim.
Include verbs from daily life: movement (go, come, walk, run), communication (say, speak, write, read, listen), actions (do, make, take, give, eat, drink, buy, sell), mental (think, know, understand, want, need, forget, remember), state (be, have, feel, seem), work/school (study, teach, work, finish, start).
Return ONLY a JSON array of English infinitives WITHOUT "to" (e.g. "go", "eat", "speak").`,
    count: 100,
  },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function askForWordList(prompt: string): Promise<string[]> {
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });
  const raw = msg.content.map((b) => ("text" in b ? b.text : "")).join("");
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON array in word list response");
  return JSON.parse(match[0]).map((w: unknown) => String(w).trim()).filter(Boolean);
}

async function generateCard(word: string, level: string): Promise<Record<string, unknown> | null> {
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: [{ type: "text", text: CARD_GENERATION_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: `Generate a vocabulary card for: "${word}" (target level: ${level})

IMPORTANT: If the input is an inflected or prefixed form, generate the card for the BASE/DICTIONARY form. Always lemmatize first.`,
      }],
    });
    const raw = msg.content.map((b) => ("text" in b ? b.text : "")).join("");
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (err) {
    console.error(`  ✗ Failed to generate card for "${word}":`, err);
    return null;
  }
}

async function saveSystemCard(
  cardData: Record<string, unknown>,
  level: string,
  systemDeck: string
): Promise<boolean> {
  const english = ((cardData.english as string) ?? "").toLowerCase().trim();
  if (!english) return false;

  const { error } = await supabase.from("system_cards").upsert(
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

  if (error) {
    console.error(`  ✗ DB error for "${english}":`, error.message);
    return false;
  }
  return true;
}

// ── Conjugation seed ──────────────────────────────────────────────────────────

async function seedConjugationsForVerbs(): Promise<void> {
  console.log("\n── Seeding conjugation tables for verb system_cards ──");

  const { data: verbs } = await supabase
    .from("system_cards")
    .select("hebrew, grammar_info")
    .eq("system_deck", "verbs")
    .eq("word_type", "verb");

  if (!verbs?.length) {
    console.log("  No verb system_cards found — skipping conjugation seed.");
    return;
  }

  // Import conjugation prompt dynamically
  const { CONJUGATION_SYSTEM } = await import("../lib/prompts/conjugation");

  let done = 0;
  const CONJ_BATCH = 5; // slower — conjugation output is larger

  for (let i = 0; i < verbs.length; i += CONJ_BATCH) {
    const batch = verbs.slice(i, i + CONJ_BATCH);
    await Promise.allSettled(
      batch.map(async (verb) => {
        const info = verb.grammar_info as Record<string, unknown> | null;
        const binyan = (info?.binyan as string) ?? "pa'al";
        const infinitive = (info?.infinitive as string) ?? verb.hebrew;

        // Check if already cached
        const { data: existing } = await supabase
          .from("conjugation_tables")
          .select("id")
          .eq("verb_hebrew", verb.hebrew)
          .eq("binyan", binyan)
          .maybeSingle();

        if (existing) { done++; return; }

        try {
          const msg = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2048,
            system: [{ type: "text", text: CONJUGATION_SYSTEM, cache_control: { type: "ephemeral" } }],
            messages: [{
              role: "user",
              content: `Generate the conjugation table for:\n- verb_hebrew: ${verb.hebrew} (infinitive: ${infinitive})\n- verb_english: (common verb)\n- binyan: ${binyan}`,
            }],
          });
          const raw = msg.content.map((b) => ("text" in b ? b.text : "")).join("");
          const forms = JSON.parse(raw.replace(/```json|```/g, "").trim());
          await supabase.from("conjugation_tables").upsert(
            { verb_hebrew: verb.hebrew, binyan, forms },
            { onConflict: "verb_hebrew,binyan" }
          );
          done++;
          process.stdout.write(`  ✓ [${done}/${verbs.length}] ${verb.hebrew}\n`);
        } catch (err) {
          console.error(`  ✗ Conjugation failed for ${verb.hebrew}:`, err);
        }
      })
    );
    // Small pause between batches
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nConjugation seed complete: ${done}/${verbs.length} tables.`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Hebrew System Cards Seed ===\n");
  console.log("This will generate ~500 cards and ~100 conjugation tables.");
  console.log("Estimated cost: ~$1.00 | Estimated time: 10-15 minutes\n");

  for (const deck of DECKS) {
    console.log(`\n── Deck: ${deck.id} (${deck.count} words) ──`);

    // Fetch words already in this deck to avoid re-generating
    const { data: existing } = await supabase
      .from("system_cards")
      .select("english")
      .eq("system_deck", deck.id);
    const existingSet = new Set((existing ?? []).map((r) => r.english));

    if (existingSet.size >= deck.count) {
      console.log(`  Already seeded (${existingSet.size} cards). Skipping.`);
      continue;
    }

    // Get word list from Claude
    console.log("  Requesting word list from Claude…");
    let words: string[];
    try {
      words = await askForWordList(deck.prompt);
      console.log(`  Got ${words.length} words.`);
    } catch (err) {
      console.error("  ✗ Word list failed:", err);
      continue;
    }

    // Filter out already-seeded words
    const toGenerate = words.filter((w) => !existingSet.has(w.toLowerCase()));
    console.log(`  ${toGenerate.length} new words to generate.`);

    let saved = 0;
    const BATCH = 8;

    for (let i = 0; i < toGenerate.length; i += BATCH) {
      const batch = toGenerate.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (word) => {
          const cardData = await generateCard(word, deck.level);
          if (!cardData) return;
          const ok = await saveSystemCard(cardData, deck.level, deck.id);
          if (ok) {
            saved++;
            process.stdout.write(`  ✓ [${saved + existingSet.size}/${deck.count}] ${word}\n`);
          }
        })
      );
      // Log any unexpected rejections
      results.forEach((r, idx) => {
        if (r.status === "rejected") {
          console.error(`  ✗ Batch item ${idx} rejected:`, r.reason);
        }
      });
      // Small pause between batches to respect rate limits
      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`  Deck ${deck.id}: ${saved} new cards saved.`);
  }

  // Seed conjugation tables for all verb system_cards
  await seedConjugationsForVerbs();

  console.log("\n=== Seed complete ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
