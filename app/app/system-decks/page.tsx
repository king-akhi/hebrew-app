"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PreviewCard } from "@/app/api/system-decks/preview/route";

type SystemDeck = {
  id: string;
  name: string;
  description: string;
  level: string | null;
  count: number;
};

const LEVEL_COLOR: Record<string, string> = {
  A1: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  A2: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  B1: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const PAGE_SIZE = 30;

export default function SystemDecksPage() {
  const [decks, setDecks] = useState<SystemDeck[]>([]);
  const [loading, setLoading] = useState(true);

  // Preview modal state
  const [activeDeck, setActiveDeck] = useState<SystemDeck | null>(null);
  const [preview, setPreview] = useState<PreviewCard[]>([]);
  const [totalRemaining, setTotalRemaining] = useState(0);
  const [offset, setOffset] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/system-decks")
      .then((r) => r.json())
      .then((data) => setDecks(data.decks ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function openPreview(deck: SystemDeck) {
    setActiveDeck(deck);
    setOffset(0);
    setImportedCount(0);
    setImportError(null);
    await fetchPreview(deck.id, 0);
  }

  async function fetchPreview(deckId: string, newOffset: number) {
    setPreviewLoading(true);
    try {
      const res = await fetch(
        `/api/system-decks/preview?deck=${deckId}&offset=${newOffset}&limit=${PAGE_SIZE}`
      );
      const data = await res.json();
      setPreview(data.cards ?? []);
      setTotalRemaining(data.total_remaining ?? 0);
      setOffset(newOffset);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleImport() {
    if (!activeDeck || importing || preview.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/system-decks/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deck: activeDeck.id,
          card_ids: preview.map((c) => c.id),
        }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setImportError("You've reached your daily card limit. Come back tomorrow or increase your limit in Settings.");
        return;
      }
      const newlyImported = importedCount + (data.imported ?? 0);
      setImportedCount(newlyImported);
      // Load next batch
      const nextOffset = offset + PAGE_SIZE;
      if (nextOffset < totalRemaining) {
        await fetchPreview(activeDeck.id, nextOffset);
      } else {
        setPreview([]);
        setTotalRemaining(0);
      }
    } finally {
      setImporting(false);
    }
  }

  function closeModal() {
    setActiveDeck(null);
    setPreview([]);
    setTotalRemaining(0);
    setOffset(0);
    setImportedCount(0);
  }

  const allDone = activeDeck && preview.length === 0;
  const nextBatchCount = Math.min(PAGE_SIZE, totalRemaining - offset - PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Explore Decks</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Curated vocabulary decks — import 30 words at a time.
          </p>
        </div>
        <Link
          href="/app"
          className="text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          ← Back
        </Link>
      </div>

      {loading && <div className="text-sm text-zinc-400">Loading decks…</div>}

      {!loading && decks.length === 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No curated decks available yet.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {decks.map((deck) => (
          <div
            key={deck.id}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-medium text-sm leading-snug">{deck.name}</h2>
              {deck.level && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${LEVEL_COLOR[deck.level] ?? ""}`}>
                  {deck.level}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{deck.description}</p>
            <div className="flex items-center justify-between mt-auto pt-1">
              <span className="text-xs text-zinc-400 dark:text-zinc-500">{deck.count} words remaining</span>
              <button
                onClick={() => openPreview(deck)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 transition-opacity"
              >
                Import 30 new words
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview modal */}
      {activeDeck && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={closeModal} />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
            <div
              className="pointer-events-auto w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-700 flex flex-col max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h2 className="font-semibold text-sm">{activeDeck.name}</h2>
                  {importedCount > 0 && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {importedCount} words added so far
                    </p>
                  )}
                </div>
                <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">×</button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-3">
                {previewLoading && (
                  <p className="text-sm text-zinc-400 text-center py-8">Loading…</p>
                )}

                {allDone && !previewLoading && (
                  <div className="text-center py-8 space-y-2">
                    <p className="text-2xl">🎉</p>
                    <p className="text-sm font-medium">All done!</p>
                    <p className="text-xs text-zinc-500">{importedCount} words added to your deck.</p>
                  </div>
                )}

                {!previewLoading && !allDone && preview.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-400 mb-3">
                      Showing {preview.length} of {totalRemaining} words not yet in your deck:
                    </p>
                    {preview.map((card) => (
                      <div
                        key={card.id}
                        className="flex items-center justify-between py-1.5 border-b border-zinc-50 dark:border-zinc-800 last:border-0"
                      >
                        <span className="text-sm font-medium" dir="rtl">{card.hebrew}</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{card.english}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {!allDone && !previewLoading && preview.length > 0 && (
                <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                  {importError && (
                    <p className="text-xs text-red-500 text-center">{importError}</p>
                  )}
                  <button
                    onClick={handleImport}
                    disabled={importing || !!importError}
                    className="w-full py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
                  >
                    {importing
                      ? "Importing…"
                      : `Import these ${preview.length} words →`}
                  </button>
                  <button
                    onClick={closeModal}
                    className="w-full py-2 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {allDone && (
                <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    onClick={closeModal}
                    className="w-full py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium hover:opacity-80 transition-opacity"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
