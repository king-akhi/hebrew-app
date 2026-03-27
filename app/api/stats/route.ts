/**
 * GET /api/stats
 *
 * Returns gamification stats for the authenticated user:
 * - streak (consecutive active days, with 1 grace day)
 * - words_mastered (FSRS: review state, reps≥3, stability≥7d)
 * - total_cards
 * - learning_rate (mastered / total, as %)
 * - heatmap (last 84 days: date → activity count)
 * - today_reviews / today_practice
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function toDateStr(iso: string) {
  return iso.substring(0, 10); // "YYYY-MM-DD"
}

function dateMinusDays(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().substring(0, 10);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since84 = new Date(Date.now() - 84 * 86400000).toISOString();

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [reviewsRes, practiceRes, conjugationRes, fsrsRes, decksRes] = await Promise.all([
    supabase
      .from("reviews")
      .select("created_at")
      .eq("user_id", user.id)
      .gte("created_at", since84),
    supabase
      .from("correction_logs")
      .select("created_at")
      .eq("user_id", user.id)
      .gte("created_at", since84),
    supabase
      .from("conjugation_logs")
      .select("created_at")
      .eq("user_id", user.id)
      .gte("created_at", since84),
    supabase
      .from("fsrs_state")
      .select("card_id, state, reps, stability")
      .eq("user_id", user.id),
    supabase
      .from("decks")
      .select("id")
      .eq("created_by", user.id),
  ]);

  const reviews = reviewsRes.data ?? [];
  const practice = practiceRes.data ?? [];
  const conjugationLogs = conjugationRes.data ?? [];
  const fsrsRows = fsrsRes.data ?? [];
  const deckIds = (decksRes.data ?? []).map((d) => d.id);

  // Count cards created today
  let todayCardsAdded = 0;
  if (deckIds.length > 0) {
    const { count } = await supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .in("deck_id", deckIds)
      .gte("created_at", todayStart.toISOString());
    todayCardsAdded = count ?? 0;
  }

  // ── Heatmap ────────────────────────────────────────────────
  const activityMap = new Map<string, number>();
  for (const r of reviews) {
    const d = toDateStr(r.created_at);
    activityMap.set(d, (activityMap.get(d) ?? 0) + 1);
  }
  for (const p of practice) {
    const d = toDateStr(p.created_at);
    activityMap.set(d, (activityMap.get(d) ?? 0) + 1);
  }
  for (const c of conjugationLogs) {
    const d = toDateStr(c.created_at);
    activityMap.set(d, (activityMap.get(d) ?? 0) + 1);
  }

  const heatmap: { date: string; count: number }[] = [];
  for (let i = 83; i >= 0; i--) {
    const date = dateMinusDays(i);
    heatmap.push({ date, count: activityMap.get(date) ?? 0 });
  }

  // ── Streak (with 1 grace day) ──────────────────────────────
  const activeDates = new Set(activityMap.keys());
  const today = dateMinusDays(0);
  const yesterday = dateMinusDays(1);

  // Start from today if active, otherwise yesterday
  let streakStart = activeDates.has(today)
    ? today
    : activeDates.has(yesterday)
    ? yesterday
    : null;

  let streak = 0;
  if (streakStart) {
    let current = streakStart;
    let graceUsed = false;

    while (true) {
      if (activeDates.has(current)) {
        streak++;
        graceUsed = false;
      } else if (!graceUsed) {
        // Skip this day as grace — don't increment streak, but continue
        graceUsed = true;
      } else {
        break; // two consecutive missing days → streak ends
      }
      // Move to previous day
      const prev = new Date(current + "T12:00:00Z");
      prev.setUTCDate(prev.getUTCDate() - 1);
      const prevStr = prev.toISOString().substring(0, 10);

      // Stop if we've gone further than 84 days back
      if (prevStr < dateMinusDays(84)) break;
      current = prevStr;
    }
  }

  // ── Words mastered & total ─────────────────────────────────
  const masteredCards = new Set<string>();
  const totalCards = new Set<string>();

  for (const row of fsrsRows) {
    totalCards.add(row.card_id);
    if (
      row.state === "review" &&
      row.reps >= 2 &&
      row.stability >= 5
    ) {
      masteredCards.add(row.card_id);
    }
  }

  const wordsMastered = masteredCards.size;
  const totalCount = totalCards.size;
  const learningRate =
    totalCount > 0 ? Math.round((wordsMastered / totalCount) * 100) : 0;

  // ── Today's activity ───────────────────────────────────────
  const todayReviews = reviews.filter((r) =>
    toDateStr(r.created_at) === today
  ).length;
  const todayPractice = practice.filter((p) =>
    toDateStr(p.created_at) === today
  ).length + conjugationLogs.filter((c) =>
    toDateStr(c.created_at) === today
  ).length;

  return NextResponse.json({
    streak,
    words_mastered: wordsMastered,
    total_cards: totalCount,
    learning_rate: learningRate,
    heatmap,
    today_reviews: todayReviews,
    today_practice: todayPractice,
    today_cards_added: todayCardsAdded,
  });
}
