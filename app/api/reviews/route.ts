/**
 * POST /api/reviews
 *
 * Submits a review rating for a card, updates FSRS state, and logs the review.
 *
 * Request body:
 *   { card_id: string; rating: 1|2|3|4; response_time_ms?: number }
 *
 * Response:
 *   { interval_days: number; next_due: string }
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { schedule, type FSRSState, type Rating, type CustomIntervals, DEFAULT_INTERVALS } from "@/lib/fsrs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { card_id: string; rating: Rating; direction?: string; response_time_ms?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.card_id || ![1, 2, 3, 4].includes(body.rating)) {
    return NextResponse.json({ error: "card_id and rating (1–4) required" }, { status: 400 });
  }

  // Fetch user's custom SRS intervals (fall back to defaults if columns missing)
  const { data: userPrefs } = await supabase
    .from("users")
    .select("srs_again_minutes, srs_hard_hours, srs_good_days, srs_easy_days")
    .eq("id", user.id)
    .maybeSingle();

  const intervals: CustomIntervals = userPrefs
    ? {
        againMinutes: userPrefs.srs_again_minutes ?? DEFAULT_INTERVALS.againMinutes,
        hardHours:    userPrefs.srs_hard_hours    ?? DEFAULT_INTERVALS.hardHours,
        goodDays:     userPrefs.srs_good_days     ?? DEFAULT_INTERVALS.goodDays,
        easyDays:     userPrefs.srs_easy_days     ?? DEFAULT_INTERVALS.easyDays,
      }
    : DEFAULT_INTERVALS;

  // Fetch current FSRS state (if any)
  const direction = body.direction ?? "he_to_en";

  const { data: fsrsRow, error: fetchError } = await supabase
    .from("fsrs_state")
    .select("*")
    .eq("user_id", user.id)
    .eq("card_id", body.card_id)
    .eq("direction", direction)
    .maybeSingle();

  if (fetchError) {
    console.error("[reviews] Fetch error:", fetchError);
    return NextResponse.json({ error: "Failed to fetch card state" }, { status: 500 });
  }

  const currentState: FSRSState | null = fsrsRow
    ? {
        stability: fsrsRow.stability,
        difficulty: fsrsRow.difficulty,
        due: new Date(fsrsRow.due),
        lastReview: fsrsRow.last_review ? new Date(fsrsRow.last_review) : null,
        reps: fsrsRow.reps,
        lapses: fsrsRow.lapses,
        state: fsrsRow.state,
      }
    : null;

  const now = new Date();
  const { nextState, intervalDays } = schedule(currentState, body.rating, now, intervals);

  // Upsert fsrs_state
  const { error: upsertError } = await supabase.from("fsrs_state").upsert(
    {
      user_id: user.id,
      card_id: body.card_id,
      direction,
      stability: nextState.stability,
      difficulty: nextState.difficulty,
      due: nextState.due.toISOString(),
      last_review: now.toISOString(),
      reps: nextState.reps,
      lapses: nextState.lapses,
      state: nextState.state,
    },
    { onConflict: "user_id,card_id,direction" }
  );

  if (upsertError) {
    console.error("[reviews] Upsert error:", upsertError);
    return NextResponse.json({ error: "Failed to update FSRS state" }, { status: 500 });
  }

  // Log review
  await supabase.from("reviews").insert({
    user_id: user.id,
    card_id: body.card_id,
    rating: body.rating,
    response_time_ms: body.response_time_ms ?? null,
    created_at: now.toISOString(),
  });

  return NextResponse.json({
    interval_days: intervalDays,
    next_due: nextState.due.toISOString(),
  });
}
