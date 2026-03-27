/**
 * POST /api/cards
 *
 * Generates a Hebrew vocabulary card for a given word, saves it to the user's
 * personal deck, and creates an initial FSRS state row (due immediately).
 *
 * Request body:
 *   { word: string; level?: "A1" | "A2" | "B1" | "B2" }
 *
 * Response:
 *   { card: Card }
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateCardContent, saveCard, getOrCreateDeck, countCardsCreatedToday } from "@/lib/cards/generate";
import { checkSystemCache, saveToSystemCache } from "@/lib/cards/system-cache";

const DEFAULT_DAILY_LIMIT = 20;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { word: string; level?: "A1" | "A2" | "B1" | "B2"; context?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.word?.trim()) {
    return NextResponse.json({ error: "word is required" }, { status: 400 });
  }

  const word = body.word.trim().slice(0, 100);
  const level = body.level ?? "A1";
  const context = body.context?.trim().slice(0, 300) ?? undefined;

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id, daily_card_limit")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "User profile not found" }, { status: 404 });

  // Enforce daily card limit
  const limit = profile.daily_card_limit ?? DEFAULT_DAILY_LIMIT;
  const createdToday = await countCardsCreatedToday(user.id, supabase);
  if (createdToday >= limit) {
    return NextResponse.json(
      { error: "daily_limit_reached", limit, created_today: createdToday },
      { status: 429 }
    );
  }

  let deckId: string;
  try {
    deckId = await getOrCreateDeck(user.id, profile.organization_id, level, supabase);
  } catch {
    return NextResponse.json({ error: "Failed to create deck" }, { status: 500 });
  }

  let cardData: Record<string, unknown>;
  const cached = await checkSystemCache(word, supabase);
  if (cached) {
    cardData = cached;
  } else {
    try {
      cardData = await generateCardContent(word, level, context);
    } catch (err) {
      console.error("[cards] Generation error:", err);
      return NextResponse.json({ error: "Card generation failed" }, { status: 500 });
    }
    // Fire-and-forget: write to system cache for future users
    saveToSystemCache(cardData, level, null, supabase).catch(() => {});
  }

  try {
    const { card } = await saveCard(cardData, deckId, user.id, supabase);
    return NextResponse.json({ card });
  } catch (err) {
    console.error("[cards] Save error:", err);
    return NextResponse.json({ error: "Failed to save card" }, { status: 500 });
  }
}
