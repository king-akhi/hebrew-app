/**
 * POST /api/cards/stream
 *
 * SSE streaming variant of POST /api/cards.
 * Emits card content progressively as Claude generates it, then saves and
 * emits the final saved card.
 *
 * SSE event types:
 *   { t: "chunk",       v: string }                — text delta from Claude
 *   { t: "saved",       card: SavedCard }           — card saved, generation done
 *   { t: "proper_noun", hebrew: string, english: string } — word is a proper noun
 *   { t: "error",       error: string }             — unrecoverable error
 *
 * Non-200 JSON responses (same as /api/cards):
 *   401 Unauthorized
 *   400 Invalid request
 *   404 User profile not found
 *   429 daily_limit_reached { limit, created_today }
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  buildCardUserMessage,
  saveCard,
  getOrCreateDeck,
  countCardsCreatedToday,
} from "@/lib/cards/generate";
import { checkSystemCache, saveToSystemCache } from "@/lib/cards/system-cache";
import { CARD_GENERATION_SYSTEM } from "@/lib/prompts/card-generation";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DEFAULT_DAILY_LIMIT = 20;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  // Parallel: profile + daily count + system cache
  const [profileResult, createdToday, cached] = await Promise.all([
    supabase.from("users").select("organization_id, daily_card_limit").eq("id", user.id).single(),
    countCardsCreatedToday(user.id, supabase),
    context ? Promise.resolve(null) : checkSystemCache(word, supabase),
  ]);

  const profile = profileResult.data;
  if (!profile) return NextResponse.json({ error: "User profile not found" }, { status: 404 });

  const limit = profile.daily_card_limit ?? DEFAULT_DAILY_LIMIT;
  if (createdToday >= limit) {
    return NextResponse.json(
      { error: "daily_limit_reached", limit, created_today: createdToday },
      { status: 429 }
    );
  }

  const encoder = new TextEncoder();

  function emit(controller: ReadableStreamDefaultController, data: object) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Cache hit: skip streaming, save immediately
        if (cached) {
          const deckId = await getOrCreateDeck(
            user.id,
            profile.organization_id,
            level,
            supabase
          );
          const { card } = await saveCard(cached, deckId, user.id, supabase);
          emit(controller, { t: "saved", card });
          controller.close();
          return;
        }

        // Start deck lookup and Claude stream in parallel
        const deckIdPromise = getOrCreateDeck(
          user.id,
          profile.organization_id,
          level,
          supabase
        );

        const claudeStream = anthropic.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 600,
          system: [
            {
              type: "text" as const,
              text: CARD_GENERATION_SYSTEM,
              cache_control: { type: "ephemeral" as const },
            },
          ],
          messages: [
            { role: "user" as const, content: buildCardUserMessage(word, level, context) },
          ],
        });

        let fullText = "";
        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const text = event.delta.text;
            fullText += text;
            emit(controller, { t: "chunk", v: text });
          }
        }

        const jsonMatch = fullText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          emit(controller, { t: "error", error: "Card generation failed" });
          controller.close();
          return;
        }

        const cardData = JSON.parse(jsonMatch[0]);

        if (cardData.is_proper_noun === true) {
          emit(controller, {
            t: "proper_noun",
            hebrew: cardData.full_form ?? word,
            english: cardData.english ?? "",
          });
          controller.close();
          return;
        }

        if (!context) {
          saveToSystemCache(cardData, level, null, supabase).catch(() => {});
        }

        // Await deck ID (likely already resolved)
        const deckId = await deckIdPromise;
        const { card } = await saveCard(cardData, deckId, user.id, supabase);
        emit(controller, { t: "saved", card });
        controller.close();
      } catch (err) {
        console.error("[cards/stream] Error:", err);
        try {
          emit(controller, { t: "error", error: "Card generation failed" });
          controller.close();
        } catch {
          // controller may already be closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
