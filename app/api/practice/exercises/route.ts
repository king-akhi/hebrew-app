/**
 * GET /api/practice/exercises?limit=10
 *
 * Generates writing exercises from the authenticated user's vocabulary deck.
 * Cards are selected by review count (most-practised first) so exercises
 * reinforce words the user is actively learning.
 *
 * Response (has cards):
 *   { exercises: Exercise[], empty: false }
 *
 * Response (no cards yet):
 *   { exercises: [], empty: true }
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { EXERCISE_GENERATION_SYSTEM } from "@/lib/prompts/exercise-generation";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(parseInt(limitParam ?? "10", 10) || 10, 50);
  const sessionType = request.nextUrl.searchParams.get("type") ?? "random";

  // Fetch user's known_tenses setting
  const { data: userSettings } = await supabase
    .from("users")
    .select("known_tenses")
    .eq("id", user.id)
    .single();
  const knownTenses: string[] = (userSettings as unknown as { known_tenses?: string[] })?.known_tenses ?? ["present"];

  // Fetch up to 20 of the user's cards, ordered by reps desc so we
  // prefer words they've already started learning over brand-new ones.
  const { data: fsrsRows, error: fetchError } = await supabase
    .from("fsrs_state")
    .select(`
      card_id,
      state,
      reps,
      cards (
        id,
        hebrew,
        transliteration,
        english,
        grammar_notes,
        tags
      )
    `)
    .eq("user_id", user.id)
    .order("reps", { ascending: false })
    .limit(20);

  if (fetchError) {
    console.error("[practice/exercises] Fetch error:", fetchError);
    return NextResponse.json({ error: "Failed to fetch cards" }, { status: 500 });
  }

  type CardData = {
    card_id: string;
    state: string;
    reps: number;
    hebrew: string;
    english: string;
    grammar_notes: string | null;
    tags: string[];
  };

  const cards: CardData[] = (fsrsRows ?? [])
    .filter((row) => row.cards !== null)
    .map((row) => {
      const c = row.cards as unknown as {
        hebrew: string;
        english: string;
        grammar_notes: string | null;
        tags: string[];
      };
      return {
        card_id: row.card_id as string,
        state: row.state as string,
        reps: row.reps as number,
        hebrew: c.hebrew,
        english: c.english,
        grammar_notes: c.grammar_notes,
        tags: c.tags ?? [],
      };
    });

  if (cards.length === 0) {
    return NextResponse.json({ exercises: [], empty: true });
  }

  // Pick the cards to turn into exercises (up to `limit`)
  const selected = cards.slice(0, limit);

  const cardsText = selected
    .map(
      (c) =>
        `card_id: ${c.card_id}\nhebrew: ${c.hebrew}\nenglish: ${c.english}\ngrammar_notes: ${c.grammar_notes ?? "none"}\ntags: ${c.tags.join(", ")}`
    )
    .join("\n\n");

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: EXERCISE_GENERATION_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Session type: ${sessionType}\nAllowed verb tenses: ${knownTenses.join(", ")} — NEVER generate exercises requiring tenses not in this list.\n\nGenerate ${selected.length} exercises for these vocabulary cards:\n\n${cardsText}`,
        },
      ],
    });

    const raw = message.content
      .map((block) => ("text" in block ? block.text : ""))
      .join("");

    const exercises = JSON.parse(raw.replace(/```json|```/g, "").trim());

    return NextResponse.json({ exercises, empty: false });
  } catch (err) {
    console.error("[practice/exercises] Generation error:", err);
    return NextResponse.json(
      { error: "Exercise generation failed" },
      { status: 500 }
    );
  }
}
