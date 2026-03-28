"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ListenButton from "@/components/ListenButton";
import TagEditor, { isThematicTag, isCustomTag } from "@/components/TagEditor";
import GrammarBox from "@/components/GrammarBox";

interface Card {
  id: string;
  hebrew: string;
  transliteration: string | null;
  english: string;
  example_sentence_he: string | null;
  example_sentence_transliteration: string | null;
  example_sentence_en: string | null;
  grammar_notes: string | null;
  word_type: string | null;
  grammar_info: Record<string, unknown> | null;
  tags: string[];
}

interface PartialCard {
  hebrew?: string;
  transliteration?: string;
  english?: string;
  example_sentence_he?: string;
  example_sentence_transliteration?: string;
  example_sentence_en?: string;
}

interface LimitState {
  limit: number;
  created_today: number;
}

type Stage = "idle" | "streaming" | "done";

const LOADING_MESSAGES = [
  "Analyzing root letters…",
  "Checking grammar rules…",
  "Building example sentence…",
  "Adding transliteration…",
  "Finalizing your card…",
];

const FUN_FACTS = [
  "Modern Hebrew is the only successfully revived spoken language in history — brought back from near-extinction in the 1880s.",
  "Most Hebrew words share a 3-letter root. The root כ-ת-ב gives כתב (wrote), כתיבה (writing), מכתב (letter), כתובת (address).",
  "שלום (shalom) means peace, hello, and goodbye — all in one word.",
  "Hebrew numbers have grammatical gender: שלושה ילדים (3 boys) but שלוש ילדות (3 girls).",
  "Hebrew has no capital letters — every sentence starts exactly like the one before it.",
  "The Hebrew alphabet has 22 letters, all consonants. Vowels are optional dots and dashes added below.",
  "Five Hebrew letters change shape at the end of a word: כ→ך, מ→ם, נ→ן, פ→ף, צ→ץ",
  "Israeli Hebrew has absorbed words from Arabic, English, French, and Yiddish — it's a living mosaic.",
  "The letter ע (ayin) is a guttural stop that has no equivalent in most European languages.",
  "Biblical Hebrew and Modern Hebrew are 2,000+ years apart, yet largely mutually intelligible.",
];

/** Extract a completed JSON string field from a partial JSON accumulation. */
function extractField(text: string, field: string): string | null {
  const regex = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
  const match = text.match(regex);
  if (!match) return null;
  return match[1]
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");
}

const STREAM_FIELDS = [
  "hebrew",
  "transliteration",
  "english",
  "example_sentence_he",
  "example_sentence_transliteration",
  "example_sentence_en",
] as const;

export default function AddWordForm({
  level,
  onCreated,
}: {
  level?: "A1" | "A2" | "B1" | "B2";
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [word, setWord] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<Card | null>(null);
  const [streamCard, setStreamCard] = useState<PartialCard>({});
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [limitState, setLimitState] = useState<LimitState | null>(null);
  const [bumpingLimit, setBumpingLimit] = useState(false);
  const [properNoun, setProperNoun] = useState<{ hebrew: string; english: string } | null>(null);
  const [msgIndex, setMsgIndex] = useState(0);
  const [currentFact, setCurrentFact] = useState("");
  const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rotate loading messages while streaming
  useEffect(() => {
    if (stage === "streaming") {
      setMsgIndex(0);
      msgIntervalRef.current = setInterval(() => {
        setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
      }, 800);
    } else {
      if (msgIntervalRef.current) {
        clearInterval(msgIntervalRef.current);
        msgIntervalRef.current = null;
      }
    }
    return () => {
      if (msgIntervalRef.current) clearInterval(msgIntervalRef.current);
    };
  }, [stage]);

  async function startStreaming(wordToStream: string) {
    setCurrentFact(FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)]);
    setStage("streaming");
    setStreamCard({});
    setResult(null);
    setError(null);
    setLimitState(null);
    setProperNoun(null);
    setConfirmDelete(false);

    try {
      const res = await fetch("/api/cards/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: wordToStream.trim(), level: level ?? "A1" }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setLimitState({ limit: data.limit, created_today: data.created_today });
        setStage("idle");
        return;
      }

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Card generation failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(payload);
          } catch {
            continue;
          }

          if (event.t === "chunk" && typeof event.v === "string") {
            accumulated += event.v;
            const updates: Partial<PartialCard> = {};
            let hasUpdates = false;
            for (const field of STREAM_FIELDS) {
              const val = extractField(accumulated, field);
              if (val !== null) {
                updates[field] = val;
                hasUpdates = true;
              }
            }
            if (hasUpdates) setStreamCard((prev) => ({ ...prev, ...updates }));
          } else if (event.t === "saved") {
            const card = event.card as Card;
            setResult(card);
            setTags(card.tags ?? []);
            setStage("done");
            setWord("");
            router.refresh();
            if (onCreated) onCreated();
            if (card.word_type === "verb") {
              fetch(`/api/conjugation?cardId=${card.id}`).catch(() => {});
            }
          } else if (event.t === "proper_noun") {
            setProperNoun({
              hebrew: typeof event.hebrew === "string" ? event.hebrew : wordToStream,
              english: typeof event.english === "string" ? event.english : "",
            });
            setStage("done");
            setWord("");
          } else if (event.t === "error") {
            throw new Error(
              typeof event.error === "string" ? event.error : "Card generation failed"
            );
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("idle");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!word.trim()) return;
    await startStreaming(word);
  }

  async function handleBumpLimit(increment: number) {
    if (!limitState) return;
    setBumpingLimit(true);
    const newLimit = limitState.limit + increment;
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_card_limit: newLimit }),
      });
      if (!res.ok) throw new Error("Failed to update limit");
      setLimitState(null);
      startStreaming(word);
    } catch {
      setError("Failed to update daily limit.");
    } finally {
      setBumpingLimit(false);
    }
  }

  async function handleDelete() {
    if (!result) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/cards/${result.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setResult(null);
      setConfirmDelete(false);
      setStage("idle");
      router.refresh();
    } catch {
      // silently ignore
    } finally {
      setDeleting(false);
    }
  }

  const visibleTags = tags.filter((t) => isThematicTag(t) || isCustomTag(t));

  const isHebrew = /[\u0590-\u05FF]/.test(word);

  return (
    <div className="space-y-4">
      {/* Input form — idle only */}
      {stage === "idle" && (
        <>
          {!properNoun && !limitState && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Enter any word in Hebrew or English — a complete flashcard will be generated automatically.
            </p>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="e.g. אהבה or 'love'"
              autoFocus
              className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
            <button
              type="submit"
              disabled={!word.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate
            </button>
          </form>
        </>
      )}

      {/* Streaming skeleton — progressive card reveal */}
      {stage === "streaming" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          {/* Card front */}
          <div className="p-6 text-center space-y-2 border-b border-zinc-100 dark:border-zinc-800">
            {streamCard.hebrew ? (
              <p className="text-4xl font-medium leading-tight" dir="rtl" lang="he">
                {streamCard.hebrew}
              </p>
            ) : isHebrew ? (
              <p className="text-4xl font-medium leading-tight opacity-30" dir="rtl" lang="he">
                {word}
              </p>
            ) : (
              <div className="h-10 w-32 bg-zinc-100 dark:bg-zinc-800 rounded-lg mx-auto animate-pulse" />
            )}
            {streamCard.transliteration ? (
              <p className="text-zinc-400 text-sm">{streamCard.transliteration}</p>
            ) : (
              <div className="h-3.5 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full animate-pulse mx-auto" />
            )}
          </div>

          {/* Card back */}
          <div className="p-5 space-y-3">
            {streamCard.english ? (
              <p className="text-lg font-semibold">{streamCard.english}</p>
            ) : (
              <div className="h-6 w-28 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
            )}

            {streamCard.example_sentence_he ? (
              <div className="space-y-0.5">
                <p className="text-sm text-right" dir="rtl" lang="he">
                  {streamCard.example_sentence_he}
                </p>
                {streamCard.example_sentence_transliteration && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 text-right italic">
                    {streamCard.example_sentence_transliteration}
                  </p>
                )}
                {streamCard.example_sentence_en && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {streamCard.example_sentence_en}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
            )}

            {/* Rotating message */}
            <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-1">
              {LOADING_MESSAGES[msgIndex]}
            </p>

            {/* Hebrew fun fact */}
            {currentFact && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <span className="font-semibold">Did you know?</span> {currentFact}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Daily limit banner */}
      {stage === "idle" && limitState && (
        <div dir="ltr" className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Daily limit reached</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              You&apos;ve added {limitState.created_today} cards today (limit: {limitState.limit}).
              Increase your limit to continue.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">Increase by:</span>
            {[5, 10, 20].map((n) => (
              <button
                key={n}
                onClick={() => handleBumpLimit(n)}
                disabled={bumpingLimit}
                className="px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-xs font-medium hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors disabled:opacity-50"
              >
                +{n}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-xs">{error}</p>}

      {/* Proper noun display */}
      {stage === "done" && properNoun && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-6 text-center space-y-3">
            <p className="text-4xl font-medium leading-tight" dir="rtl" lang="he">
              {properNoun.hebrew}
            </p>
            <p className="text-base font-medium">{properNoun.english}</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              This is a proper noun — not a vocabulary word
            </p>
          </div>
          <div className="px-5 pb-5">
            <button
              onClick={() => { setStage("idle"); setProperNoun(null); }}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              + Add another card
            </button>
          </div>
        </div>
      )}

      {/* Result card */}
      {stage === "done" && result && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          {/* Front */}
          <div className="p-6 text-center space-y-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-center gap-3">
              <p className="text-4xl font-medium leading-tight" dir="rtl" lang="he">
                {result.word_type === "verb" && result.grammar_info?.infinitive
                  ? (result.grammar_info.infinitive as string)
                  : result.hebrew}
              </p>
              <ListenButton
                text={
                  result.word_type === "verb" && result.grammar_info?.infinitive
                    ? (result.grammar_info.infinitive as string)
                    : result.hebrew
                }
                size="md"
              />
            </div>
            {(result.word_type === "verb"
              ? result.grammar_info?.infinitive_transliteration as string | undefined
              : result.transliteration) && (
              <p className="text-zinc-400 text-sm">
                {result.word_type === "verb"
                  ? (result.grammar_info?.infinitive_transliteration as string)
                  : result.transliteration}
              </p>
            )}
          </div>

          {/* Back */}
          <div className="p-5 space-y-3">
            <p className="text-lg font-semibold">{result.english}</p>

            {result.example_sentence_he && (
              <div className="space-y-0.5">
                <div className="flex items-start justify-end gap-2">
                  <ListenButton text={result.example_sentence_he} size="sm" />
                  <p className="text-sm" dir="rtl" lang="he">{result.example_sentence_he}</p>
                </div>
                {result.example_sentence_transliteration && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 text-right italic">
                    {result.example_sentence_transliteration}
                  </p>
                )}
                {result.example_sentence_en && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{result.example_sentence_en}</p>
                )}
              </div>
            )}

            <GrammarBox
              wordType={result.word_type}
              grammarInfo={result.grammar_info as Parameters<typeof GrammarBox>[0]["grammarInfo"]}
              fallback={result.grammar_notes}
            />

            {visibleTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {visibleTags.map((t) => (
                  <span
                    key={t}
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      isCustomTag(t)
                        ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="space-y-3 pt-1">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ Added — will appear in today&apos;s review
              </p>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setStage("idle"); setResult(null); setConfirmDelete(false); }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  + Add another card
                </button>

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
          </div>
        </div>
      )}
    </div>
  );
}
