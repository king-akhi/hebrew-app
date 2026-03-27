/**
 * FSRS-5 (Free Spaced Repetition Scheduler) — TypeScript port
 *
 * Based on the FSRS-5 algorithm by Jarrett Ye.
 * Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 *
 * Core concepts:
 *   stability (S) — how long until 90% retention (in days)
 *   difficulty (D) — intrinsic card difficulty, 1 (easy) → 10 (hard)
 *   retrievability (R) — current recall probability given elapsed time
 *   state — 'new' | 'learning' | 'review' | 'relearning'
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type CardState = "new" | "learning" | "review" | "relearning";

/** Rating the user gives after each review */
export type Rating = 1 | 2 | 3 | 4; // 1=Again, 2=Hard, 3=Good, 4=Easy

export interface FSRSState {
  stability: number;   // S — days until 90% retention
  difficulty: number;  // D — 1..10
  due: Date;           // next review date
  lastReview: Date | null;
  reps: number;        // total review count
  lapses: number;      // times the card was forgotten (Again)
  state: CardState;
}

export interface ReviewResult {
  nextState: FSRSState;
  intervalDays: number;
}

/** User-configurable interval overrides for first-exposure cards */
export interface CustomIntervals {
  againMinutes: number; // Again  → reschedule in N minutes
  hardHours:    number; // Hard   → reschedule in N hours
  goodDays:     number; // Good   → reschedule in N days
  easyDays:     number; // Easy   → reschedule in N days
}

// ── FSRS-5 default parameters (w vector) ──────────────────────────────────
// These are the globally optimized weights from the FSRS-5 paper.
// Individual users can fine-tune these via optimizer (future feature).

const W = [
  0.4072, 1.1829, 3.1262, 15.4722, // initial stability for ratings 1-4
  7.2102,  // difficulty decay
  0.5316,  // recall sigmoid
  1.0651,  // recall sigmoid slope
  0.0589,  // difficulty modifier for hard
  1.5330,  // stability after lapse (sigmoid multiplier)
  0.1544,  // difficulty modifier for good
  1.0060,  // stability growth for easy
  1.9395,  // retrieval after lapse
  0.1100,  // minimum stability after lapse
  0.2900,  // stability growth from hard reviews
  2.2700,  // stability growth from good reviews
  2.9898,  // stability growth from easy reviews
  0.5100,  // initial difficulty growth
  2.2700,  // difficulty decay factor
  0.1,     // minimum stability floor
] as const;

const DECAY = -0.5;
const FACTOR = 19 / 81; // = (0.9)^(1/DECAY) - 1

// ── Core math ──────────────────────────────────────────────────────────────

/** R(t, S) — retrievability after t days given stability S */
function retrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + FACTOR * (elapsedDays / stability), DECAY);
}

/** Initial stability after the very first review, by rating */
function initialStability(rating: Rating): number {
  return W[rating - 1];
}

/** Initial difficulty after the very first review */
function initialDifficulty(rating: Rating): number {
  return W[4] - Math.exp(W[5] * (rating - 1)) + 1;
}

/** Clamp difficulty to [1, 10] */
function clampDifficulty(d: number): number {
  return Math.max(1, Math.min(10, d));
}

/** Update difficulty after a review */
function nextDifficulty(d: number, rating: Rating): number {
  const delta = W[6] * (rating - 3);
  const mean = W[7] * initialDifficulty(1) + (1 - W[7]) * (d - delta);
  return clampDifficulty(mean);
}

/** Stability after a successful recall (state = 'review') */
function nextStabilityAfterRecall(
  d: number,
  s: number,
  r: number,
  rating: Rating
): number {
  const hardPenalty = rating === 2 ? W[15] : 1;
  const easyBonus = rating === 4 ? W[16] : 1;

  return (
    s *
    (Math.exp(W[8]) *
      (11 - d) *
      Math.pow(s, -W[9]) *
      (Math.exp((1 - r) * W[10]) - 1) *
      hardPenalty *
      easyBonus +
      1)
  );
}

/** Stability after a lapse (rating = Again, state becomes 'relearning') */
function nextStabilityAfterLapse(
  d: number,
  s: number,
  r: number
): number {
  return Math.max(
    W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]),
    0.1
  );
}

// ── Interval calculation ───────────────────────────────────────────────────

const MIN_INTERVAL_DAYS = 1;
const MAX_INTERVAL_DAYS = 36500; // ~100 years
const AGAIN_RELEARN_MINUTES = 5;  // "Again" → review in 5 min (same session)
const HARD_HOURS = 8;             // "Hard" → review in ~8h (same day/evening)
const GOOD_DAYS = 2;              // "Good" → review in 2 days
const EASY_DAYS = 7;              // "Easy" → review in 7 days (1 week)

export const DEFAULT_INTERVALS: CustomIntervals = {
  againMinutes: AGAIN_RELEARN_MINUTES,
  hardHours:    HARD_HOURS,
  goodDays:     GOOD_DAYS,
  easyDays:     EASY_DAYS,
};

/**
 * Given a stability value, return the interval in days
 * that achieves the target retention rate (default 90%).
 */
function intervalFromStability(stability: number, requestedRetention = 0.9): number {
  const raw = (stability / FACTOR) * (Math.pow(requestedRetention, 1 / DECAY) - 1);
  return Math.min(Math.max(Math.round(raw), MIN_INTERVAL_DAYS), MAX_INTERVAL_DAYS);
}

// ── Main schedule function ─────────────────────────────────────────────────

/**
 * Compute the next FSRS state after a review.
 *
 * @param current  Current FSRS state (or null for a brand-new card)
 * @param rating   User's self-assessment: 1=Again, 2=Hard, 3=Good, 4=Easy
 * @param now      Timestamp of the review (defaults to now)
 * @returns        New state and interval in days
 */
export function schedule(
  current: FSRSState | null,
  rating: Rating,
  now: Date = new Date(),
  intervals: CustomIntervals = DEFAULT_INTERVALS
): ReviewResult {
  // ── Brand new card ────────────────────────────────────────────────────────
  if (current === null || current.state === "new") {
    const s = initialStability(rating);
    const d = initialDifficulty(rating);

    // Fixed intervals for first exposure — user-configurable
    let due: Date;
    let intervalDays: number;
    if (rating === 1) {       // Again → same session
      due = addMinutes(now, intervals.againMinutes);
      intervalDays = 0;
    } else if (rating === 2) { // Hard → same day
      due = addHours(now, intervals.hardHours);
      intervalDays = 0;
    } else if (rating === 3) { // Good
      due = addDays(now, intervals.goodDays);
      intervalDays = intervals.goodDays;
    } else {                   // Easy
      due = addDays(now, intervals.easyDays);
      intervalDays = intervals.easyDays;
    }

    const nextState: FSRSState = {
      stability: s,
      difficulty: d,
      due,
      lastReview: now,
      reps: 1,
      lapses: 0,
      state: rating === 1 ? "learning" : "review",
    };

    return { nextState, intervalDays };
  }

  const elapsedDays = daysBetween(current.lastReview ?? current.due, now);
  const r = retrievability(elapsedDays, current.stability);
  const d = nextDifficulty(current.difficulty, rating);

  // ── Lapse (Again on a review card) ───────────────────────────────────────
  if (rating === 1) {
    const s = nextStabilityAfterLapse(current.difficulty, current.stability, r);

    const nextState: FSRSState = {
      stability: s,
      difficulty: d,
      due: addDays(now, 1), // relearn tomorrow
      lastReview: now,
      reps: current.reps + 1,
      lapses: current.lapses + 1,
      state: "relearning",
    };

    return { nextState, intervalDays: 1 };
  }

  // ── Successful recall ─────────────────────────────────────────────────────
  const s = nextStabilityAfterRecall(current.difficulty, current.stability, r, rating);
  const intervalDays = intervalFromStability(s);

  const nextState: FSRSState = {
    stability: s,
    difficulty: d,
    due: addDays(now, intervalDays),
    lastReview: now,
    reps: current.reps + 1,
    lapses: current.lapses,
    state: "review",
  };

  return { nextState, intervalDays };
}

/**
 * Get all cards due for review for a user.
 * Pass the raw DB rows from fsrs_state and filter/sort here,
 * or use this as a reference for the Supabase query.
 *
 * SQL equivalent:
 *   SELECT * FROM fsrs_state WHERE user_id = $1 AND due <= now() ORDER BY due ASC
 */
export function isDue(state: FSRSState, now: Date = new Date()): boolean {
  return state.due <= now;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}
