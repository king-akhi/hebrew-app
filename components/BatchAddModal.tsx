"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ListenButton from "@/components/ListenButton";
import GrammarBox from "@/components/GrammarBox";

const COUNT_OPTIONS = [5, 10, 20, 30];

type BatchCard = {
  id: string;
  hebrew: string;
  transliteration: string | null;
  english: string;
  example_sentence_he: string | null;
  example_sentence_en: string | null;
  grammar_notes: string | null;
  word_type: string | null;
  grammar_info: Record<string, unknown> | null;
  tags: string[];
};

type BatchResult = {
  cards: BatchCard[];
  created: number;
  failures: { word: string; error: string }[];
  capped_at?: number;
  daily_limit?: number;
};

// ── Inline card preview panel ────────────────────────────────────────────────

function CardPreview({ card, onClose }: { card: BatchCard; onClose: () => void }) {
  const displayHebrew =
    card.word_type === "verb" && card.grammar_info?.infinitive
      ? (card.grammar_info.infinitive as string)
      : card.hebrew;

  const displayTranslit =
    card.word_type === "verb"
      ? (card.grammar_info?.infinitive_transliteration as string | undefined)
      : card.transliteration ?? undefined;

  return (
    <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Card preview</span>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Front */}
      <div className="px-4 py-3 text-center space-y-1 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-center gap-2">
          <p className="text-3xl font-medium" dir="rtl" lang="he">{displayHebrew}</p>
          <ListenButton text={displayHebrew} size="md" />
        </div>
        {displayTranslit && (
          <p className="text-zinc-400 text-sm">{displayTranslit}</p>
        )}
      </div>

      {/* Back */}
      <div className="px-4 py-3 space-y-2">
        <p className="font-semibold">{card.english}</p>

        {card.example_sentence_he && (
          <div className="space-y-0.5">
            <div className="flex items-start justify-end gap-2">
              <ListenButton text={card.example_sentence_he} size="sm" />
              <p className="text-sm" dir="rtl" lang="he">{card.example_sentence_he}</p>
            </div>
            {card.example_sentence_en && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{card.example_sentence_en}</p>
            )}
          </div>
        )}

        <GrammarBox
          wordType={card.word_type}
          grammarInfo={card.grammar_info as Parameters<typeof GrammarBox>[0]["grammarInfo"]}
          fallback={card.grammar_notes}
        />
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function BatchAddModal({
  level,
  open: controlledOpen,
  onClose,
}: {
  level?: "A1" | "A2" | "B1" | "B2";
  open?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const [theme, setTheme] = useState("");
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<BatchCard | null>(null);
  const [limitState, setLimitState] = useState<{ limit: number; created_today: number } | null>(null);
  const [bumpingLimit, setBumpingLimit] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 50);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function handleClose() {
    if (isControlled) { onClose?.(); } else { setInternalOpen(false); }
    setResult(null);
    setError(null);
    setTheme("");
    setCount(10);
    setSelectedCard(null);
    setLimitState(null);
  }

  async function runBatch() {
    const res = await fetch("/api/cards/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: theme.trim(), count, level: level ?? "A1" }),
    });
    const data = await res.json();
    if (res.status === 429) {
      setLimitState({ limit: data.limit, created_today: data.created_today });
      return;
    }
    if (!res.ok) throw new Error(data.error ?? "Failed to generate cards");
    setResult(data);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!theme.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setLimitState(null);
    setSelectedCard(null);
    try {
      await runBatch();
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
      if (!res.ok) throw new Error();
      setLimitState(null);
      setLoading(true);
      try {
        await runBatch();
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

  function handleCardClick(card: BatchCard) {
    setSelectedCard((prev) => (prev?.id === card.id ? null : card));
  }

  return (
    <>
      {!isControlled && (
        <button
          onClick={() => setInternalOpen(true)}
          className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium transition-colors"
        >
          + Batch add
        </button>
      )}

      {open && (
        <div
          ref={overlayRef}
          onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-16 px-4"
        >
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <h2 className="font-semibold text-sm">Add words by theme</h2>
              <button
                onClick={handleClose}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-lg leading-none"
              >
                ×
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1">
              {!result ? (
                <div className="p-5 space-y-4">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Enter a theme and a complete set of vocabulary cards will be generated for you.
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Theme
                      </label>
                      <input
                        ref={inputRef}
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        placeholder="e.g. cooking, family, travel, work…"
                        disabled={loading}
                        className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 disabled:opacity-50"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Number of cards
                      </label>
                      <div className="flex gap-2">
                        {COUNT_OPTIONS.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setCount(n)}
                            disabled={loading}
                            className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
                              count === n
                                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                                : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Daily limit banner */}
                    {limitState && (
                      <div dir="ltr" className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                          Daily limit reached — {limitState.created_today}/{limitState.limit} cards today
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-amber-700 dark:text-amber-400">Increase by:</span>
                          {[5, 10, 20].map((n) => (
                            <button
                              key={n}
                              type="button"
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

                    {loading && (
                      <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-1">
                        Generating {count} cards on &ldquo;{theme}&rdquo;…
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={loading || !theme.trim()}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? "Generating…" : `Generate ${count} cards`}
                    </button>
                  </form>
                </div>
              ) : (
                <div>
                  {/* Summary bar */}
                  <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-4 text-sm flex-wrap">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ {result.created} added
                    </span>
                    {result.capped_at !== undefined && (
                      <span className="text-amber-500 text-xs">
                        Capped at {result.capped_at} (daily limit {result.daily_limit})
                      </span>
                    )}
                    {result.failures.length > 0 && (
                      <span className="text-amber-500">
                        {result.failures.length} failed
                      </span>
                    )}
                  </div>

                  {/* Card list */}
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {result.cards.map((card) => (
                      <div key={card.id}>
                        <button
                          onClick={() => handleCardClick(card)}
                          className={`w-full text-left px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center justify-between gap-3 ${
                            selectedCard?.id === card.id ? "bg-zinc-50 dark:bg-zinc-800/50" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sm font-medium truncate">{card.english}</span>
                            <span className="text-zinc-300 dark:text-zinc-600 text-xs">→</span>
                            <span className="text-sm" dir="rtl" lang="he">{card.hebrew}</span>
                            {card.transliteration && (
                              <span className="text-xs text-zinc-400 truncate hidden sm:block">
                                {card.word_type === "verb"
                                  ? (card.grammar_info?.infinitive_transliteration as string | undefined) ?? card.transliteration
                                  : card.transliteration}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-zinc-300 dark:text-zinc-600 text-xs">
                              {selectedCard?.id === card.id ? "▲" : "▼"}
                            </span>
                          </div>
                        </button>

                        {selectedCard?.id === card.id && (
                          <CardPreview card={card} onClose={() => setSelectedCard(null)} />
                        )}
                      </div>
                    ))}

                    {/* Failed words */}
                    {result.failures.map(({ word, error: reason }) => (
                      <div
                        key={word}
                        className="px-5 py-3 flex items-center gap-3"
                      >
                        <span className="text-sm text-zinc-400 line-through">{word}</span>
                        <span className="text-xs text-amber-500">failed — try adding it manually</span>
                        <span className="text-xs text-zinc-300 dark:text-zinc-600 truncate hidden sm:block">
                          {reason.slice(0, 60)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
                    <button
                      onClick={() => { setResult(null); setTheme(""); setSelectedCard(null); }}
                      className="flex-1 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm font-medium transition-colors"
                    >
                      Add another theme
                    </button>
                    <button
                      onClick={handleClose}
                      className="flex-1 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
