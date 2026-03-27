"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ListenButton from "@/components/ListenButton";
import { ClickableHebrew } from "@/components/HebrewWord";
import { useSound } from "@/hooks/useSound";
import { useConfetti } from "@/hooks/useConfetti";
import { compareHebrew } from "@/lib/conjugation";
import type { ConjugationExercise } from "@/app/api/conjugation/exercises/route";

// ── Types ──────────────────────────────────────────────────────

interface TranslateExercise {
  id: string;
  card_id: string;
  hebrew: string;
  english: string;
  category: string;
  hint: string;
}

type AnyExercise = TranslateExercise | ConjugationExercise;

interface CorrectionResult {
  is_correct: boolean;
  is_partially_correct: boolean;
  error_type: string | null;
  correction_short: string;
  rule_explanation: string | null;
  corrected_form: string | null;
  corrected_form_transliteration: string | null;
  example_sentence: string | null;
}

type SessionType = "random" | "conjugation" | "grammar" | "vocab";
type Stage = "setup" | "loading" | "input" | "submitting" | "result";

function isConjugationEx(ex: AnyExercise): ex is ConjugationExercise {
  return "correct_hebrew" in ex;
}

const SESSION_TYPES: { value: SessionType; label: string; description: string }[] = [
  { value: "random",      label: "Random",      description: "Mix of all exercise types" },
  { value: "conjugation", label: "Conjugation", description: "Verb conjugation forms" },
  { value: "grammar",     label: "Grammar",     description: "Agreement, plurals, articles" },
  { value: "vocab",       label: "Vocabulary",  description: "Single word translations" },
];

const COUNTS = [5, 10, 20] as const;

// ── Component ──────────────────────────────────────────────────

export default function PracticePage() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");         // "conjugation" | null
  const cardIdParam = searchParams.get("cardId");     // specific verb card id

  const isConjugationMode = modeParam === "conjugation";

  const { playSuccess } = useSound();
  const { burst } = useConfetti();

  // Setup state
  const [selectedCount, setSelectedCount] = useState<number>(10);
  const [customCount, setCustomCount] = useState("");
  const [sessionType, setSessionType] = useState<SessionType>("random");

  // Session state
  const [queue, setQueue] = useState<AnyExercise[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [stage, setStage] = useState<Stage>("setup");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const [emptyHint, setEmptyHint] = useState<string | null>(null);

  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    setSpeechSupported(!!(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);

  function toggleListening() {
    if (isListening) { recognitionRef.current?.stop(); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = "he-IL";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results as unknown[])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript)
        .join("");
      setAnswer(transcript);
    };
    recognition.start();
  }

  const resolvedCount = customCount ? parseInt(customCount, 10) || selectedCount : selectedCount;
  const effectiveType: SessionType = isConjugationMode ? "conjugation" : sessionType;

  const loadExercises = useCallback(async () => {
    setStage("loading");
    setLoadError(null);
    setEmpty(false);
    setEmptyHint(null);
    setQueue([]);
    setTotalCount(0);
    setCompletedCount(0);
    setAnswer("");
    setResult(null);
    setDone(false);

    try {
      let res: Response;
      if (effectiveType === "conjugation") {
        const params = new URLSearchParams({ count: String(resolvedCount) });
        if (cardIdParam) params.set("cardId", cardIdParam);
        res = await fetch(`/api/conjugation/exercises?${params}`);
      } else {
        res = await fetch(`/api/practice/exercises?limit=${resolvedCount}&type=${effectiveType}`);
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load exercises");

      if (data.empty) {
        setEmpty(true);
        setEmptyHint(data.hint ?? null);
        setStage("input");
      } else {
        setQueue(data.exercises);
        setTotalCount(data.exercises.length);
        setStage("input");
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load exercises");
      setStage("setup");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveType, resolvedCount, cardIdParam]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || stage !== "input") return;
    recognitionRef.current?.stop();

    const exercise = queue[0];
    setStage("submitting");
    setError(null);

    // Conjugation: local comparison
    if (isConjugationEx(exercise)) {
      const verdict = compareHebrew(answer.trim(), exercise.correct_hebrew, exercise.person);
      const isCorrect = verdict === "correct";
      if (isCorrect) playSuccess();
      setResult({
        is_correct: isCorrect,
        is_partially_correct: false,
        error_type: null,
        correction_short: isCorrect ? "Correct!" : "Not quite",
        rule_explanation: isCorrect ? null : `${exercise.person_label} ${exercise.tense}: ${exercise.correct_hebrew} (${exercise.correct_transliteration})`,
        corrected_form: exercise.correct_hebrew,
        corrected_form_transliteration: exercise.correct_transliteration,
        example_sentence: null,
      });
      setStage("result");

      // Log to DB for streak/heatmap
      fetch("/api/conjugation/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verb_hebrew: exercise.verb_hebrew, correct: isCorrect }),
      }).catch(() => {});
      return;
    }

    // Translate: call /api/correct
    try {
      const res = await fetch("/api/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_text: `Translate to Hebrew: "${exercise.english}"`,
          expected_hebrew: exercise.hebrew ?? null,
          student_answer: answer.trim(),
          exercise_type: effectiveType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Correction failed");
      setResult(data);
      setStage("result");
      if (data.is_correct || data.is_partially_correct) playSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("input");
    }
  }

  async function handleNoIdea() {
    recognitionRef.current?.stop();
    const exercise = queue[0];

    if (isConjugationEx(exercise)) {
      setResult({
        is_correct: false,
        is_partially_correct: false,
        error_type: null,
        correction_short: `${exercise.person_label} ${exercise.tense}`,
        rule_explanation: null,
        corrected_form: exercise.correct_hebrew,
        corrected_form_transliteration: exercise.correct_transliteration,
        example_sentence: null,
      });
      setStage("result");
      return;
    }

    setStage("submitting");
    setError(null);
    try {
      const res = await fetch("/api/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_text: `Translate to Hebrew: "${exercise.english}"`,
          student_answer: "(no answer — the learner did not attempt this exercise, just show the correct form)",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Correction failed");
      setResult({ ...data, is_correct: false, is_partially_correct: false });
      setStage("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("input");
    }
  }

  function handleNext(wasCorrect: boolean) {
    recognitionRef.current?.stop();
    setAnswer("");
    setResult(null);
    setStage("input");

    if (wasCorrect) {
      // Remove from queue, mark completed
      const newQueue = queue.slice(1);
      const newCompleted = completedCount + 1;
      setQueue(newQueue);
      setCompletedCount(newCompleted);
      if (newQueue.length === 0) {
        burst();
        setDone(true);
      }
    } else {
      // Move current exercise to position 3 (or end if queue is short)
      const rest = queue.slice(1);
      const insertAt = Math.min(3, rest.length);
      const newQueue = [...rest.slice(0, insertAt), queue[0], ...rest.slice(insertAt)];
      setQueue(newQueue);
    }
  }

  // ── Setup screen ─────────────────────────────────────────────
  if (stage === "setup") {
    return (
      <div className="space-y-8 max-w-xl mx-auto">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Practice
            </span>
          </div>
          <h1 className="text-xl font-semibold">
            {isConjugationMode ? "Conjugation Practice" : "Translate"}
          </h1>
          {isConjugationMode && cardIdParam && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Practicing one verb</p>
          )}
          {isConjugationMode && !cardIdParam && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Practicing all your verbs</p>
          )}
        </div>

        {loadError && (
          <p className="text-sm text-red-500">{loadError}</p>
        )}

        {/* Count picker */}
        <div className="space-y-3">
          <p className="text-sm font-medium">How many questions?</p>
          <div className="flex flex-wrap gap-2">
            {COUNTS.map((n) => (
              <button
                key={n}
                onClick={() => { setSelectedCount(n); setCustomCount(""); }}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  selectedCount === n && !customCount
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
                }`}
              >
                {n}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={50}
              placeholder="Custom"
              value={customCount}
              onChange={(e) => { setCustomCount(e.target.value); }}
              className={`w-24 px-3 py-2 rounded-lg border text-sm transition-colors ${
                customCount
                  ? "border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900"
                  : "border-zinc-200 dark:border-zinc-700"
              } bg-white dark:bg-zinc-900 focus:outline-none`}
            />
          </div>
        </div>

        {/* Session type picker — only for Translate (not conjugation mode) */}
        {!isConjugationMode && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Session type</p>
            <div className="grid grid-cols-2 gap-2">
              {SESSION_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setSessionType(t.value)}
                  className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                    sessionType === t.value
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <p className={`text-sm font-medium ${sessionType === t.value ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
                    {t.label}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">{t.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Link
            href={isConjugationMode ? (cardIdParam ? `/app/verbs/${cardIdParam}` : "/app/verbs") : "/app"}
            className="px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Back
          </Link>
          <button
            onClick={loadExercises}
            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Start session →
          </button>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────
  if (stage === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100 rounded-full animate-spin" />
        <p className="text-sm text-zinc-400">Generating your exercises…</p>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────
  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-6 text-center">
        <div className="space-y-2">
          <p className="text-5xl">📭</p>
          <h1 className="text-xl font-semibold">
            {isConjugationMode ? "No conjugation tables yet" : "No vocabulary yet"}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-xs">
            {emptyHint ?? (isConjugationMode
              ? "Visit the Verbs page to generate conjugation tables first."
              : "Add words from the dashboard first.")}
          </p>
        </div>
        <Link
          href={isConjugationMode ? "/app/verbs" : "/app"}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          {isConjugationMode ? "Go to Verbs →" : "Add words →"}
        </Link>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-6 text-center">
        <div className="space-y-2">
          <p className="text-5xl">✨</p>
          <h1 className="text-2xl font-semibold">Practice complete!</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            You answered all {totalCount} exercises correctly.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setStage("setup"); setDone(false); setQueue([]); setCompletedCount(0); setTotalCount(0); }}
            className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            New session
          </button>
          <Link
            href="/app"
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const exercise = queue[0];
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const resultBorder = result
    ? result.is_correct
      ? "border-emerald-300 dark:border-emerald-700"
      : result.is_partially_correct
      ? "border-amber-300 dark:border-amber-700"
      : "border-red-300 dark:border-red-700"
    : "border-zinc-200 dark:border-zinc-800";

  const resultBg = result
    ? result.is_correct
      ? "bg-emerald-50 dark:bg-emerald-950/30"
      : result.is_partially_correct
      ? "bg-amber-50 dark:bg-amber-950/30"
      : "bg-red-50 dark:bg-red-950/30"
    : "bg-white dark:bg-zinc-900";

  // ── Session ───────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-zinc-400">
          <span>{completedCount} / {totalCount}{queue.length > 1 ? ` · ${queue.length - 1} to retry` : ""}</span>
          <button
            onClick={() => { recognitionRef.current?.stop(); setStage("setup"); setDone(false); setQueue([]); setCompletedCount(0); setTotalCount(0); }}
            className="hover:text-zinc-600 dark:hover:text-zinc-300 font-medium px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700"
          >
            End session
          </button>
        </div>
        <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Exercise card */}
      <div className={`rounded-2xl border ${resultBorder} ${resultBg} overflow-hidden transition-colors`}>
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 space-y-2">
          {isConjugationEx(exercise) ? (
            <>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Translate to Hebrew:</p>
              <p className="text-2xl font-semibold">{exercise.english_prompt.replace(/[.!?]$/, "")}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Translate to Hebrew:</p>
              <p className="text-2xl font-semibold">{exercise.english.replace(/[.!?]$/, "")}</p>
            </>
          )}
        </div>

        {/* Input / result */}
        <div className="p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-2 items-center">
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={stage !== "input"}
                placeholder={isListening ? "Listening…" : "Type your answer in Hebrew"}
                dir="rtl"
                lang="he"
                className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-3 text-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
              />
              {speechSupported && stage === "input" && (
                <button
                  type="button"
                  onClick={toggleListening}
                  title={isListening ? "Stop recording" : "Record"}
                  className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-colors border relative ${
                    isListening
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-400"
                  }`}
                >
                  {isListening && (
                    <span className="absolute inset-0 rounded-xl bg-emerald-600 animate-ping opacity-30" />
                  )}
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 relative">
                    <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm7 8a1 1 0 0 1 1 1 8 8 0 0 1-7 7.94V22h2a1 1 0 0 1 0 2H9a1 1 0 0 1 0-2h2v-2.06A8 8 0 0 1 4 12a1 1 0 0 1 2 0 6 6 0 0 0 12 0 1 1 0 0 1 1-1z" />
                  </svg>
                </button>
              )}
            </div>

            {stage === "input" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleNoIdea}
                  className="flex-1 py-2.5 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  No idea
                </button>
                <button
                  type="submit"
                  disabled={!answer.trim()}
                  className="flex-[2] py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Check
                </button>
              </div>
            )}

            {stage === "submitting" && (
              <div className="text-center py-2 text-sm text-zinc-400">Checking…</div>
            )}
          </form>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  {result.is_correct ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm shrink-0">✓ Correct!</span>
                  ) : result.is_partially_correct ? (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold text-sm shrink-0">◎ Almost!</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 font-semibold text-sm shrink-0">✗ Not quite</span>
                  )}
                  <span className="text-sm text-zinc-600 dark:text-zinc-300">{result.correction_short}</span>
                </div>
              </div>

              {result.corrected_form && (
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-medium leading-relaxed">
                      {isConjugationEx(exercise) ? (
                        <span dir="rtl" lang="he">{result.corrected_form}</span>
                      ) : (
                        <ClickableHebrew text={result.corrected_form} />
                      )}
                    </p>
                    <ListenButton text={result.corrected_form} size="md" />
                  </div>
                  {result.corrected_form_transliteration && (
                    <p className="text-sm text-zinc-400">{result.corrected_form_transliteration}</p>
                  )}
                  {!isConjugationEx(exercise) && (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      Tap any word to add it to your deck
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={() => handleNext(result.is_correct || result.is_partially_correct)}
                className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                {result.is_correct || result.is_partially_correct ? "Next →" : "Try again later →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
