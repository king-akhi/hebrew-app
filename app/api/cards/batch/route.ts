/**
 * POST /api/cards/batch
 *
 * Generates multiple Hebrew vocabulary cards for a given theme.
 * Fetches the user's existing deck words first so Claude never suggests words
 * they already have. Retries once if any cards still slip through dedup.
 *
 * Request body:
 *   { theme: string; count: number; level?: "A1" | "A2" | "B1" | "B2" }
 *
 * Response:
 *   { cards: Card[]; created: number; failures: { word: string; error: string }[] }
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateCardContent, saveCard, getOrCreateDeck, countCardsCreatedToday } from "@/lib/cards/generate";
import { checkSystemCache, saveToSystemCache } from "@/lib/cards/system-cache";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_COUNT = 50;
const DEFAULT_DAILY_LIMIT = 20;

async function fetchWordList(
  theme: string,
  count: number,
  level: string,
  exclude: string[]
): Promise<string[]> {
  const exclusionNote =
    exclude.length > 0
      ? `\nDo NOT include any of these words the user already knows: ${exclude.join(", ")}`
      : "";

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Generate a list of exactly ${count} Hebrew vocabulary words related to the theme: "${theme}".
Target level: ${level}.
Rules:
- Choose the most common, practical words a learner would actually use
- Prefer high-frequency words appropriate for level ${level}
- No duplicates${exclusionNote}
- Return ONLY a JSON array of English words/phrases, nothing else
- Example: ["kitchen", "to cook", "knife", "stove", "refrigerator"]`,
      },
    ],
  });

  const raw = msg.content.map((b) => ("text" in b ? b.text : "")).join("");
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  if (!arrayMatch) throw new Error(`No JSON array in response: ${raw.slice(0, 200)}`);
  const parsed = JSON.parse(arrayMatch[0]);
  if (!Array.isArray(parsed)) throw new Error("Response is not an array");
  return parsed.slice(0, count).map((w: unknown) => String(w).trim()).filter(Boolean);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { theme: string; count: number; level?: "A1" | "A2" | "B1" | "B2" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.theme?.trim()) {
    return NextResponse.json({ error: "theme is required" }, { status: 400 });
  }
  if (!body.count || body.count < 1) {
    return NextResponse.json({ error: "count must be at least 1" }, { status: 400 });
  }

  const theme = body.theme.trim().slice(0, 100);
  const count = Math.min(Math.floor(body.count), MAX_COUNT);
  const level = body.level ?? "A1";

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id, daily_card_limit")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "User profile not found" }, { status: 404 });

  // Cap count to remaining daily capacity
  const dailyLimit = profile.daily_card_limit ?? DEFAULT_DAILY_LIMIT;
  const createdToday = await countCardsCreatedToday(user.id, supabase);
  const remaining = dailyLimit - createdToday;
  if (remaining <= 0) {
    return NextResponse.json(
      { error: "daily_limit_reached", limit: dailyLimit, created_today: createdToday },
      { status: 429 }
    );
  }
  const effectiveCount = Math.min(count, remaining);

  let deckId: string;
  try {
    deckId = await getOrCreateDeck(user.id, profile.organization_id, level, supabase);
  } catch {
    return NextResponse.json({ error: "Failed to create deck" }, { status: 500 });
  }

  // Fetch existing English words so Claude doesn't suggest them
  const { data: existingCards } = await supabase
    .from("cards")
    .select("english")
    .eq("deck_id", deckId);

  const existingWords = (existingCards ?? []).map((c) => c.english.toLowerCase());
  const userId = user.id;

  // Step 1: Ask for a word list, excluding what the user already has
  let wordList: string[];
  try {
    wordList = await fetchWordList(theme, effectiveCount, level, existingWords);
  } catch (err) {
    console.error("[cards/batch] Word list generation error:", err);
    return NextResponse.json({ error: "Failed to generate word list" }, { status: 500 });
  }

  // Step 2: Generate all cards in parallel
  const cards: (ReturnType<typeof Object.assign>)[] = [];
  const failures: { word: string; error: string }[] = [];
  const usedWords = new Set(existingWords);

  async function generateBatch(words: string[]) {
    const results = await Promise.allSettled(
      words.map(async (word) => {
        const cached = await checkSystemCache(word, supabase);
        let cardData;
        if (cached) {
          cardData = cached;
        } else {
          cardData = await generateCardContent(word, level);
          saveToSystemCache(cardData, level, null, supabase).catch(() => {});
        }
        const { card, created } = await saveCard(cardData, deckId, userId, supabase);
        return { card, created, word };
      })
    );

    for (const [i, result] of results.entries()) {
      if (result.status === "fulfilled") {
        if (result.value.created) {
          cards.push(result.value.card);
          usedWords.add(result.value.word.toLowerCase());
        }
        // silently skip existing — not counted as failure
      } else {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error(`[cards/batch] Failed for word "${words[i]}":`, reason);
        failures.push({ word: words[i], error: reason });
      }
    }
  }

  await generateBatch(wordList);

  // Retry: if we're still short (dedup or failures), request the missing count
  const missing = effectiveCount - cards.length;
  if (missing > 0) {
    try {
      const retryWords = await fetchWordList(
        theme,
        missing,
        level,
        [...usedWords]
      );
      await generateBatch(retryWords);
    } catch {
      // Best-effort retry — ignore errors, return what we have
    }
  }

  return NextResponse.json({
    cards,
    created: cards.length,
    failures,
    ...(effectiveCount < count ? { capped_at: effectiveCount, daily_limit: dailyLimit } : {}),
  });
}
