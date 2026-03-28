"use client";

import { useState, useEffect, useRef } from "react";
import ListenButton from "@/components/ListenButton";
import GrammarBox from "@/components/GrammarBox";

interface Card {
  id: string;
  hebrew: string;
  transliteration: string | null;
  english: string;
  example_sentence_he: string | null;
  example_sentence_en: string | null;
  grammar_notes: string | null;
  word_type: string | null;
  grammar_info: Record<string, unknown> | null;
}

// ── Modal ────────────────────────────────────────────────────────────────────

function HebrewWordModal({ word, contextSentence, onClose }: { word: string; contextSentence?: string; onClose: () => void }) {
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [limitState, setLimitState] = useState<{ limit: number; created_today: number } | null>(null);
  const [bumpingLimit, setBumpingLimit] = useState(false);
  const [properNoun, setProperNoun] = useState<{ hebrew: string; english: string } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  async function generateCard() {
    setLoading(true);
    setError(null);
    setLimitState(null);
    setProperNoun(null);
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, ...(contextSentence ? { context: contextSentence } : {}) }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setLimitState({ limit: data.limit, created_today: data.created_today });
      } else if (res.status === 422 && data.error === "proper_noun") {
        setProperNoun({ hebrew: data.hebrew, english: data.english });
      } else if (!res.ok) {
        throw new Error(data.error ?? "Failed to generate card");
      } else {
        setCard(data.card);
        // Pre-warm conjugation cache for verbs (fire-and-forget)
        if (data.card?.word_type === "verb") {
          fetch(`/api/conjugation?cardId=${data.card.id}`).catch(() => {});
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    generateCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word]);

  async function handleBumpLimit(increment: number) {
    if (!limitState) return;
    setBumpingLimit(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_card_limit: limitState.limit + increment }),
      });
      if (!res.ok) throw new Error();
      setLimitState(null);
      await generateCard();
    } catch {
      setError("Failed to update daily limit.");
    } finally {
      setBumpingLimit(false);
    }
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleDelete() {
    if (!card) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/cards/${card.id}`, { method: "DELETE" });
      if (res.ok) setDeleted(true);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const displayHebrew =
    card?.word_type === "verb" && card.grammar_info?.infinitive
      ? (card.grammar_info.infinitive as string)
      : card?.hebrew ?? word;

  const displayTranslit =
    card?.word_type === "verb"
      ? (card.grammar_info?.infinitive_transliteration as string | undefined)
      : card?.transliteration ?? undefined;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors z-10"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>

        {loading && (
          <>
            {/* Show the clicked word immediately — skeleton for the details */}
            <div className="p-6 text-center space-y-2 border-b border-zinc-100 dark:border-zinc-800">
              <p className="text-4xl font-medium leading-tight" dir="rtl" lang="he">{word}</p>
              <div className="h-3.5 w-14 bg-zinc-100 dark:bg-zinc-800 rounded-full animate-pulse mx-auto" />
            </div>
            <div className="p-5 space-y-3">
              <div className="h-5 w-28 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-3.5 w-48 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-3.5 w-36 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
              <p className="text-xs text-zinc-400 pt-1">Generating flashcard…</p>
            </div>
          </>
        )}

        {limitState && !loading && (
          <div className="p-5 space-y-3" dir="ltr">
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Daily limit reached</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  {limitState.created_today}/{limitState.limit} cards added today. Increase to continue.
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
          </div>
        )}

        {properNoun && !loading && (
          <div className="p-6 text-center space-y-3">
            <p className="text-4xl font-medium leading-tight" dir="rtl" lang="he">{properNoun.hebrew}</p>
            <p className="text-base font-medium">{properNoun.english}</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              This is a proper noun — not a vocabulary word
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm text-red-500 px-6 text-center">{error}</p>
          </div>
        )}

        {card && !loading && (
          <>
            {/* Front */}
            <div className="p-6 text-center space-y-2 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-center gap-3">
                <p className="text-4xl font-medium leading-tight" dir="rtl" lang="he">
                  {displayHebrew}
                </p>
                <ListenButton text={displayHebrew} size="md" />
              </div>
              {displayTranslit && (
                <p className="text-zinc-400 text-sm">{displayTranslit}</p>
              )}
            </div>

            {/* Back */}
            <div className="p-5 space-y-3 max-h-[50vh] overflow-y-auto">
              <p className="text-lg font-semibold">{card.english}</p>

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

              {/* Footer */}
              <div className="space-y-2 pt-1">
                {deleted ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Card removed from your deck.</p>
                ) : (
                  <>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ Added to your deck
                    </p>
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
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Confirmation bubble ───────────────────────────────────────────────────────

function ConfirmBubble({
  word,
  anchorRect,
  onConfirm,
  onDismiss,
}: {
  word: string;
  anchorRect: DOMRect;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Position: centred below the word (fixed = viewport-relative, same as getBoundingClientRect)
  const top = anchorRect.bottom + 8;
  const idealLeft = anchorRect.left + anchorRect.width / 2;

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onDismiss(); }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onDismiss]);

  return (
    <div
      ref={bubbleRef}
      style={{ position: "fixed", top, left: idealLeft, transform: "translateX(-50%)" }}
      className="z-40 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg px-4 py-3 flex flex-col items-center gap-2 min-w-[160px]"
    >
      {/* Arrow */}
      <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-zinc-800 border-l border-t border-zinc-200 dark:border-zinc-700 rotate-45" />
      <span className="text-lg font-medium" dir="rtl" lang="he">{word}</span>
      <button
        type="button"
        onClick={onConfirm}
        className="w-full py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Generate flashcard
      </button>
    </div>
  );
}

// ── Single clickable word ────────────────────────────────────────────────────

type WordState = "idle" | "confirming" | "open";

export function HebrewWord({ word, display, contextSentence }: { word: string; display?: string; contextSentence?: string }) {
  const [state, setState] = useState<WordState>("idle");
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  if (!word) return null;

  function handleClick() {
    if (state !== "idle") { setState("idle"); return; }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setAnchorRect(rect);
    setState("confirming");
  }

  return (
    <span>
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline decoration-dotted underline-offset-4 transition-colors"
        dir="rtl"
        lang="he"
      >
        {display ?? word}
      </button>

      {state === "confirming" && anchorRect && (
        <ConfirmBubble
          word={word}
          anchorRect={anchorRect}
          onConfirm={() => setState("open")}
          onDismiss={() => setState("idle")}
        />
      )}

      {state === "open" && (
        <HebrewWordModal word={word} contextSentence={contextSentence} onClose={() => setState("idle")} />
      )}
    </span>
  );
}

// ── Sentence: every word is clickable ────────────────────────────────────────

export function ClickableHebrew({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const tokens = text.split(/(\s+)/);
  return (
    <span className={className} dir="rtl" lang="he">
      {tokens.map((token, i) => {
        // Keep whitespace as-is
        if (/^\s+$/.test(token)) return <span key={i}>{token}</span>;
        // Strip surrounding punctuation to get the bare word for lookup
        const clean = token.replace(/^[.,!?;:״׳"«»()\[\]]+|[.,!?;:״׳"«»()\[\]]+$/g, "").trim();
        if (!clean) return <span key={i}>{token}</span>;
        // Preserve original display (with punctuation) but look up clean form
        return <HebrewWord key={i} word={clean} display={token} contextSentence={text} />;
      })}
    </span>
  );
}
