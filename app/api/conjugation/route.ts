/**
 * GET /api/conjugation?cardId=xxx
 *
 * Returns the full conjugation table for a verb card.
 * Fetches from cache (conjugation_tables) or generates via Haiku.
 *
 * Response: { forms: ConjugationForms, cached: boolean }
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CONJUGATION_SYSTEM } from "@/lib/prompts/conjugation";
import type { ConjugationForms } from "@/lib/conjugation";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cardId = request.nextUrl.searchParams.get("cardId");
  if (!cardId) return NextResponse.json({ error: "cardId required" }, { status: 400 });

  // Fetch the card to get verb_hebrew and binyan
  const { data: fsrsRow } = await supabase
    .from("fsrs_state")
    .select("card_id, cards(hebrew, english, word_type, grammar_info)")
    .eq("card_id", cardId)
    .eq("user_id", user.id)
    .eq("direction", "he_to_en")
    .maybeSingle();

  if (!fsrsRow?.cards) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const card = fsrsRow.cards as unknown as {
    hebrew: string;
    english: string;
    word_type: string | null;
    grammar_info: Record<string, unknown> | null;
  };

  if (card.word_type !== "verb") {
    return NextResponse.json({ error: "Card is not a verb" }, { status: 400 });
  }

  const verbHebrew = card.hebrew;
  const binyan = (card.grammar_info?.binyan as string) ?? "pa'al";
  const verbEnglish = card.english;
  const infinitive = (card.grammar_info?.infinitive as string) ?? verbHebrew;

  // Check cache
  const { data: cached } = await supabase
    .from("conjugation_tables")
    .select("forms")
    .eq("verb_hebrew", verbHebrew)
    .eq("binyan", binyan)
    .maybeSingle();

  if (cached?.forms) {
    return NextResponse.json({ forms: cached.forms as ConjugationForms, cached: true });
  }

  // Generate via Haiku
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: CONJUGATION_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Generate the conjugation table for:\n- verb_hebrew: ${verbHebrew} (infinitive: ${infinitive})\n- verb_english: to ${verbEnglish}\n- binyan: ${binyan}`,
        },
      ],
    });

    const raw = message.content
      .map((block) => ("text" in block ? block.text : ""))
      .join("");

    const forms: ConjugationForms = JSON.parse(raw.replace(/```json|```/g, "").trim());

    // Cache the result
    await supabase
      .from("conjugation_tables")
      .upsert(
        { verb_hebrew: verbHebrew, binyan, forms },
        { onConflict: "verb_hebrew,binyan" }
      );

    return NextResponse.json({ forms, cached: false });
  } catch (err) {
    console.error("[conjugation] Generation error:", err);
    return NextResponse.json({ error: "Failed to generate conjugation table" }, { status: 500 });
  }
}
