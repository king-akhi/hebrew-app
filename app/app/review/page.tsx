"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import ListenButton from "@/components/ListenButton";
import TagEditor, { isThematicTag, isCustomTag } from "@/components/TagEditor";
import EditableField from "@/components/EditableField";
import GrammarBox from "@/components/GrammarBox";
import { useSound } from "@/hooks/useSound";
import { useConfetti } from "@/hooks/useConfetti";
import { ClickableHebrew } from "@/components/HebrewWord";
import ConjugationModal from "@/components/ConjugationModal";

interface DueCard {
  fsrs_state_id: string;
  card_id: string;
  direction: "he_to_en" | "en_to_he";
  stability: number;
  difficulty: number;
  due: string;
  state: string;
  reps: number;
  lapses: number;
  hebrew: string;
  transliteration: string | null;
  english: string;
  example_sentence_he: string | null;
  example_sentence_transliteration: string | null;
  example_sentence_en: string | null;
  grammar_notes: string | null;
  word_type: string | null;
  grammar_info: Record<string, unknown> | null;
  user_notes: string | null;
  tags: string[];
}

const RATING_COLORS = [
  "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900 border-red-200 dark:border-red-800",
  "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900 border-orange-200 dark:border-orange-800",
  "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 border-emerald-200 dark:border-emerald-800",
  "bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-900 border-sky-200 dark:border-sky-800",
];

interface SRSIntervals {
  srs_again_minutes: number;
  srs_hard_hours: number;
  srs_good_days: number;
  srs_easy_days: number;
}

function formatInterval(intervals: SRSIntervals) {
  const fmt = (n: number, singular: string, plural: string) =>
    `${n % 1 === 0 ? n : n.toFixed(1)} ${n === 1 ? singular : plural}`;
  return [
    fmt(intervals.srs_again_minutes, "min",  "min"),
    fmt(intervals.srs_hard_hours,    "hr",   "hrs"),
    fmt(intervals.srs_good_days,     "day",  "days"),
    fmt(intervals.srs_easy_days,     "day",  "days"),
  ];
}

const DEFAULT_SRS: SRSIntervals = {
  srs_again_minutes: 5,
  srs_hard_hours: 8,
  srs_good_days: 2,
  srs_easy_days: 7,
};

export default function ReviewPage() {
  const { playSuccess } = useSound();
  const { burst } = useConfetti();
  const [cards, setCards] = useState<DueCard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [srsIntervals, setSrsIntervals] = useState<SRSIntervals>(DEFAULT_SRS);
  const [showConjugation, setShowConjugation] = useState(false);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cardsRes, settingsRes] = await Promise.all([
        fetch("/api/cards/due?limit=50"),
        fetch("/api/settings"),
      ]);
      const cardsData = await cardsRes.json();
      if (!cardsRes.ok) throw new Error(cardsData.error ?? "Failed to load cards");
      setCards(cardsData.cards);
      if (cardsData.cards.length === 0) setDone(true);

      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setSrsIntervals({
          srs_again_minutes: s.srs_again_minutes ?? DEFAULT_SRS.srs_again_minutes,
          srs_hard_hours:    s.srs_hard_hours    ?? DEFAULT_SRS.srs_hard_hours,
          srs_good_days:     s.srs_good_days     ?? DEFAULT_SRS.srs_good_days,
          srs_easy_days:     s.srs_easy_days     ?? DEFAULT_SRS.srs_easy_days,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  useEffect(() => {
    setStartTime(Date.now());
    setConfirmDelete(false);
    setShowConjugation(false);
  }, [index]);

  function handleFieldSave(cardId: string, field: string, value: string | null) {
    setCards((prev) =>
      prev.map((c) => (c.card_id === cardId ? { ...c, [field]: value } : c))
    );
  }

  function handleTagsChange(cardId: string, newTags: string[]) {
    setCards((prev) =>
      prev.map((c) => (c.card_id === cardId ? { ...c, tags: newTags } : c))
    );
  }

  async function handleRate(rating: 1 | 2 | 3 | 4) {
    if (submitting) return;
    const card = cards[index];
    setSubmitting(true);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_id: card.card_id,
          direction: card.direction,
          rating,
          response_time_ms: Date.now() - startTime,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit review");

      if (rating >= 3) playSuccess();

      if (index + 1 >= cards.length) {
        burst();
        // Mark review session complete for today's to-do
        localStorage.setItem("last_review_session_date", new Date().toISOString().substring(0, 10));
        setDone(true);
      } else {
        setIndex((i) => i + 1);
        setRevealed(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    const card = cards[index];
    setDeleting(true);
    try {
      const res = await fetch(`/api/cards/${card.card_id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      // Remove both directions of this card from the local queue
      const next = cards.filter((c) => c.card_id !== card.card_id);
      if (next.length === 0) {
        burst();
        localStorage.setItem("last_review_session_date", new Date().toISOString().substring(0, 10));
        setDone(true);
      } else {
        setCards(next);
        setIndex(Math.min(index, next.length - 1));
        setRevealed(false);
      }
    } catch {
      setError("Failed to delete card.");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-400">Loading cards…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-500 text-sm">{error}</p>
        <button
          onClick={loadCards}
          className="text-sm underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-6 text-center">
        <div className="space-y-2">
          <p className="text-5xl">🎉</p>
          <h1 className="text-2xl font-semibold">All done!</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            You reviewed {cards.length} card{cards.length !== 1 ? "s" : ""} today.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/app"
            className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Back to home
          </Link>
          <Link
            href="/app/practice"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Practice writing →
          </Link>
        </div>
      </div>
    );
  }

  const card = cards[index];
  const isHEtoEN = (card.direction ?? "he_to_en") === "he_to_en";
  const progress = Math.round((index / cards.length) * 100);
  const isVerb = card.word_type === "verb";

  return (
    <div className="space-y-3 max-w-xl mx-auto">
      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs text-zinc-400">{index + 1} / {cards.length}</span>
          <Link
            href="/app"
            className="text-xs font-medium px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            End session
          </Link>
        </div>
        <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">

        {/* Front */}
        <div className="p-5 text-center space-y-2 border-b border-zinc-100 dark:border-zinc-800">
          {isHEtoEN ? (
            /* HE → EN : show Hebrew (infinitive for verbs) */
            <>
              {card.word_type === "verb" && card.grammar_info?.infinitive ? (
                <>
                  <div className="flex items-center justify-center gap-3">
                    <p className="text-4xl font-medium leading-tight tracking-wide" dir="rtl" lang="he">
                      {card.grammar_info.infinitive as string}
                    </p>
                    <ListenButton text={card.grammar_info.infinitive as string} size="md" />
                  </div>
                  {card.grammar_info.infinitive_transliteration && (
                    <p className="text-zinc-400 text-sm">
                      {card.grammar_info.infinitive_transliteration as string}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-3">
                    <p className="text-4xl font-medium leading-tight tracking-wide" dir="rtl" lang="he">
                      {card.hebrew}
                    </p>
                    <ListenButton text={card.hebrew} size="md" />
                  </div>
                  {card.transliteration && (
                    <EditableField
                      cardId={card.card_id}
                      field="transliteration"
                      value={card.transliteration}
                      display={<span className="text-zinc-400 text-sm">{card.transliteration}</span>}
                      inputClassName="text-zinc-400 text-sm w-48 text-center"
                      onSave={(v) => handleFieldSave(card.card_id, "transliteration", v)}
                    />
                  )}
                </>
              )}
            </>
          ) : (
            /* EN → HE : show English */
            <p className="text-3xl font-medium">{card.english}</p>
          )}

          {/* Direction indicator */}
          <p className="text-xs text-zinc-300 dark:text-zinc-600">
            {isHEtoEN ? "HE → EN" : "EN → HE"}
          </p>
        </div>

        {/* Back: revealed content */}
        {revealed ? (
          <div className="p-4 space-y-3">
            {isHEtoEN ? (
              /* HE → EN revealed: show English */
              <EditableField
                cardId={card.card_id}
                field="english"
                value={card.english}
                display={<span className="text-lg font-semibold">{card.english}</span>}
                inputClassName="text-lg font-semibold w-48"
                onSave={(v) => handleFieldSave(card.card_id, "english", v)}
              />
            ) : (
              /* EN → HE revealed: show Hebrew + transliteration (infinitive for verbs) */
              <div className="flex items-center gap-3">
                <p className="text-2xl font-medium" dir="rtl" lang="he">
                  {card.word_type === "verb" && card.grammar_info?.infinitive
                    ? card.grammar_info.infinitive as string
                    : card.hebrew}
                </p>
                <ListenButton
                  text={
                    card.word_type === "verb" && card.grammar_info?.infinitive
                      ? card.grammar_info.infinitive as string
                      : card.hebrew
                  }
                  size="md"
                />
                {card.word_type === "verb" && card.grammar_info?.infinitive_transliteration ? (
                  <span className="text-zinc-400 text-sm">
                    {card.grammar_info.infinitive_transliteration as string}
                  </span>
                ) : card.transliteration ? (
                  <EditableField
                    cardId={card.card_id}
                    field="transliteration"
                    value={card.transliteration}
                    display={<span className="text-zinc-400 text-sm">{card.transliteration}</span>}
                    inputClassName="text-zinc-400 text-sm w-36"
                    onSave={(v) => handleFieldSave(card.card_id, "transliteration", v)}
                  />
                ) : null}
              </div>
            )}

            {/* Grammar box — directly below the word */}
            <GrammarBox
              wordType={card.word_type}
              grammarInfo={card.grammar_info as Parameters<typeof GrammarBox>[0]["grammarInfo"]}
              fallback={card.grammar_notes}
              cardId={card.word_type === "verb" ? card.card_id : undefined}
            />

            {card.example_sentence_he && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Example</p>
                <div className="flex items-start justify-end gap-2">
                  <ListenButton text={card.example_sentence_he} size="sm" />
                  <EditableField
                    cardId={card.card_id}
                    field="example_sentence_he"
                    value={card.example_sentence_he}
                    display={<ClickableHebrew text={card.example_sentence_he} className="text-base" />}
                    inputClassName="text-base w-64 text-right"
                    onSave={(v) => handleFieldSave(card.card_id, "example_sentence_he", v)}
                  />
                </div>
                {card.example_sentence_transliteration && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 text-right italic">
                    {card.example_sentence_transliteration}
                  </p>
                )}
                {card.example_sentence_en && (
                  <EditableField
                    cardId={card.card_id}
                    field="example_sentence_en"
                    value={card.example_sentence_en}
                    display={<span className="text-sm text-zinc-500 dark:text-zinc-400">{card.example_sentence_en}</span>}
                    inputClassName="text-sm w-64"
                    onSave={(v) => handleFieldSave(card.card_id, "example_sentence_en", v)}
                  />
                )}
              </div>
            )}

            <EditableField
              cardId={card.card_id}
              field="user_notes"
              value={card.user_notes}
              display={
                card.user_notes
                  ? <span className="text-xs text-zinc-500 dark:text-zinc-400 italic">{card.user_notes}</span>
                  : <span className="text-xs text-zinc-300 dark:text-zinc-600 italic">Add a note…</span>
              }
              inputClassName="text-xs w-full"
              onSave={(v) => handleFieldSave(card.card_id, "user_notes", v)}
            />

            <TagEditor
              cardId={card.card_id}
              tags={card.tags ?? []}
              onChange={(newTags) => handleTagsChange(card.card_id, newTags)}
            />

            <div className="flex items-center justify-between">
              {card.reps > 0 ? (
                <p className="text-xs text-zinc-300 dark:text-zinc-600">
                  Reviewed {card.reps} time{card.reps !== 1 ? "s" : ""} · {card.lapses} lapse{card.lapses !== 1 ? "s" : ""}
                </p>
              ) : <span />}
              {confirmDelete ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">Delete this card?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-xs text-red-600 dark:text-red-400 font-medium hover:underline disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-zinc-400 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                >
                  Delete card
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-5 flex justify-center">
            <button
              onClick={() => setRevealed(true)}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Show answer
            </button>
          </div>
        )}
      </div>

      {/* Conjugation button for verbs */}
      {revealed && isVerb && (
        <button
          onClick={() => setShowConjugation(true)}
          className="w-full py-2 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
        >
          View conjugation table
        </button>
      )}

      {/* Rating buttons */}
      {revealed && (() => {
        const labels = ["Again", "Hard", "Good", "Easy"];
        const subs = formatInterval(srsIntervals);
        return (
          <div className="grid grid-cols-4 gap-2">
            {labels.map((label, i) => (
              <button
                key={label}
                onClick={() => handleRate((i + 1) as 1 | 2 | 3 | 4)}
                disabled={submitting}
                className={`flex flex-col items-center py-3 px-2 rounded-xl border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${RATING_COLORS[i]}`}
              >
                <span className="font-semibold">{label}</span>
                <span className="opacity-70 mt-0.5">{subs[i]}</span>
              </button>
            ))}
          </div>
        );
      })()}

      {/* Conjugation modal overlay */}
      {showConjugation && isVerb && (
        <ConjugationModal
          cardId={card.card_id}
          verbHebrew={
            card.word_type === "verb" && card.grammar_info?.infinitive
              ? card.grammar_info.infinitive as string
              : card.hebrew
          }
          verbEnglish={card.english}
          infinitive={
            card.word_type === "verb" && card.grammar_info?.infinitive
              ? card.grammar_info.infinitive as string
              : card.hebrew
          }
          onClose={() => setShowConjugation(false)}
        />
      )}
    </div>
  );
}
