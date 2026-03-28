"use client";

import { useState } from "react";
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

interface LimitState {
  limit: number;
  created_today: number;
}

export default function AddWordForm({
  level,
  onCreated,
}: {
  level?: "A1" | "A2" | "B1" | "B2";
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [word, setWord] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Card | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [limitState, setLimitState] = useState<LimitState | null>(null);
  const [bumpingLimit, setBumpingLimit] = useState(false);

  async function createCard(wordToCreate: string) {
    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: wordToCreate.trim(), level: level ?? "A1" }),
    });
    const data = await res.json();
    if (res.status === 429) {
      setLimitState({ limit: data.limit, created_today: data.created_today });
      return null;
    }
    if (!res.ok) throw new Error(data.error ?? "Failed to add card");
    return data.card as Card;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!word.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setLimitState(null);
    setConfirmDelete(false);

    try {
      const card = await createCard(word);
      if (card) {
        setResult(card);
        setTags(card.tags ?? []);
        setWord("");
        router.refresh();
        // Pre-warm conjugation cache for verbs (fire-and-forget)
        if (card.word_type === "verb") {
          fetch(`/api/conjugation?cardId=${card.id}`).catch(() => {});
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
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
      // Retry the card creation now that the limit is raised
      setLoading(true);
      try {
        const card = await createCard(word);
        if (card) {
          setResult(card);
          setTags(card.tags ?? []);
          setWord("");
          router.refresh();
          if (card.word_type === "verb") {
            fetch(`/api/conjugation?cardId=${card.id}`).catch(() => {});
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
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
      router.refresh();
    } catch {
      // silently ignore
    } finally {
      setDeleting(false);
    }
  }

  const visibleTags = tags.filter((t) => isThematicTag(t) || isCustomTag(t));

  return (
    <div className="space-y-4">
      {!result && (
        <>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Enter any word in Hebrew or English — a complete flashcard will be generated automatically.
          </p>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="e.g. אהבה or 'love'"
              disabled={loading}
              autoFocus
              className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !word.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "…" : "Generate"}
            </button>
          </form>
        </>
      )}

      {loading && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-6 text-center space-y-2 border-b border-zinc-100 dark:border-zinc-800">
            {/[\u0590-\u05FF]/.test(word) ? (
              <p className="text-4xl font-medium leading-tight" dir="rtl" lang="he">{word}</p>
            ) : (
              <div className="h-10 w-28 bg-zinc-100 dark:bg-zinc-800 rounded-lg mx-auto animate-pulse" />
            )}
            <div className="h-3.5 w-14 bg-zinc-100 dark:bg-zinc-800 rounded-full animate-pulse mx-auto" />
          </div>
          <div className="p-5 space-y-3">
            <div className="h-6 w-28 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
            <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-1">Generating flashcard…</p>
          </div>
        </div>
      )}

      {/* Daily limit banner */}
      {limitState && (
        <div dir="ltr" className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Daily limit reached
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              You&apos;ve added {limitState.created_today} cards today (limit: {limitState.limit}).
              Increase your limit to continue.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
              Increase by:
            </span>
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

      {result && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          {/* Front */}
          <div className="p-6 text-center space-y-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-center gap-3">
              <p className="text-4xl font-medium leading-tight" dir="rtl" lang="he">
                {result.word_type === "verb" && result.grammar_info?.infinitive
                  ? result.grammar_info.infinitive as string
                  : result.hebrew}
              </p>
              <ListenButton
                text={
                  result.word_type === "verb" && result.grammar_info?.infinitive
                    ? result.grammar_info.infinitive as string
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
                  ? result.grammar_info?.infinitive_transliteration as string
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
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 text-right italic">{result.example_sentence_transliteration}</p>
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
                  onClick={() => { setResult(null); setConfirmDelete(false); }}
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
