"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ALL_TENSES, TENSE_LABELS, type KnownTense } from "@/lib/conjugation";
import ListenButton from "@/components/ListenButton";

// Common irregular English past tense forms that may appear in verb translations
const IRREGULAR_PAST = new Set([
  "brought","thought","taught","bought","caught","fought","sought","wrought",
  "went","came","saw","took","gave","said","got","knew","stood","understood",
  "found","told","sent","left","held","kept","felt","meant","built","lost",
  "sat","ran","met","spoke","wrote","drove","rode","rose","chose","froze",
  "threw","grew","drew","flew","blew","swam","rang","sang","began","drank",
  "wore","bore","tore","swore","struck","stuck","stung","won","hung","flung",
  "clung","swung","wove","shone","shown","beaten","hidden","fallen","taken",
]);

function cleanVerbEnglish(english: string): string {
  const parts = english.split(/,\s*/);
  const stripped = parts.map((p) => p.replace(/^to\s+/i, "").trim());
  const filtered = stripped.filter((p) => {
    const lower = p.toLowerCase();
    if (IRREGULAR_PAST.has(lower)) return false;
    // Remove regular past (-ed) only when there are other forms to keep
    if (stripped.length > 1 && lower.endsWith("ed")) return false;
    return true;
  });
  return (filtered.length > 0 ? filtered : [stripped[0]]).join(", ");
}

interface VerbCard {
  card_id: string;
  hebrew: string;
  english: string;
  infinitive: string;
  infinitive_transliteration: string | null;
  binyan: string | null;
}

export default function VerbsPage() {
  const [verbs, setVerbs] = useState<VerbCard[]>([]);
  const [knownTenses, setKnownTenses] = useState<KnownTense[]>(["present"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tense unlock confirmation
  const [confirmTense, setConfirmTense] = useState<KnownTense | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cardsRes, settingsRes] = await Promise.all([
        fetch("/api/cards/all"),
        fetch("/api/settings"),
      ]);
      const cardsData = await cardsRes.json();
      if (!cardsRes.ok) throw new Error(cardsData.error ?? "Failed to load cards");

      const verbCards: VerbCard[] = (cardsData.cards ?? [])
        .filter((c: { word_type: string | null }) => c.word_type === "verb")
        .map((c: {
          card_id: string;
          hebrew: string;
          english: string;
          grammar_info: Record<string, unknown> | null;
        }) => ({
          card_id: c.card_id,
          hebrew: c.hebrew,
          english: c.english,
          infinitive: (c.grammar_info?.infinitive as string) ?? c.hebrew,
          infinitive_transliteration: (c.grammar_info?.infinitive_transliteration as string) ?? null,
          binyan: (c.grammar_info?.binyan as string) ?? null,
        }));

      setVerbs(verbCards);

      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setKnownTenses(s.known_tenses ?? ["present"]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUnlockTense(tense: KnownTense) {
    setUnlocking(true);
    try {
      const newTenses = [...knownTenses, tense];
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ known_tenses: newTenses }),
      });
      setKnownTenses(newTenses);
    } catch {
      // silently ignore
    } finally {
      setUnlocking(false);
      setConfirmTense(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-400">Loading verbs…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-500 text-sm">{error}</p>
        <button onClick={load} className="text-sm underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Learn</span>
          </div>
          <h1 className="text-xl font-semibold mt-0.5">Verbs</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {verbs.length} verb{verbs.length !== 1 ? "s" : ""}
          </p>
        </div>
        {verbs.length > 0 && (
          <Link
            href="/app/practice?mode=conjugation"
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Practice all →
          </Link>
        )}
      </div>

      {/* Tense pills */}
      <div className="space-y-2">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Tenses you&apos;re studying:</p>
        <div className="flex flex-wrap gap-2">
          {ALL_TENSES.map((tense) => {
            const known = knownTenses.includes(tense);
            return (
              <button
                key={tense}
                onClick={() => !known && setConfirmTense(tense)}
                disabled={known}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  known
                    ? "bg-blue-600 text-white border-blue-600 cursor-default"
                    : "border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
                }`}
              >
                {TENSE_LABELS[tense]}
                {!known && <span className="ml-1 opacity-60">+ unlock</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tense unlock confirmation */}
      {confirmTense && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 space-y-3">
          <p className="text-sm font-medium">
            Unlock <strong>{TENSE_LABELS[confirmTense]}</strong>?
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            The {TENSE_LABELS[confirmTense].toLowerCase()} tense will be included in your practice sessions and example sentences.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleUnlockTense(confirmTense)}
              disabled={unlocking}
              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {unlocking ? "Unlocking…" : `Yes, unlock ${TENSE_LABELS[confirmTense]}`}
            </button>
            <button
              onClick={() => setConfirmTense(null)}
              className="px-4 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Verb list */}
      {verbs.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-4xl">📝</p>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            No verbs in your deck yet. Add words from the dashboard.
          </p>
          <Link
            href="/app"
            className="inline-block px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Add words →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {verbs.map((verb) => (
            <Link
              key={verb.card_id}
              href={`/app/verbs/${verb.card_id}`}
              className="flex items-center justify-between px-5 py-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-colors group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg font-medium" dir="rtl" lang="he">
                  {verb.infinitive}
                </span>
                <div onClick={(e) => e.preventDefault()}>
                  <ListenButton text={verb.infinitive} size="sm" />
                </div>
                {verb.infinitive_transliteration && (
                  <span className="text-sm text-zinc-400 truncate">
                    {verb.infinitive_transliteration}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">{cleanVerbEnglish(verb.english)}</p>
                  {verb.binyan && (
                    <p className="text-xs text-zinc-400">{verb.binyan}</p>
                  )}
                </div>
                <span className="text-zinc-300 dark:text-zinc-600 group-hover:text-blue-400 transition-colors">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
