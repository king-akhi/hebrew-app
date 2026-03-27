"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ConjugationTable from "@/components/ConjugationTable";
import type { ConjugationForms, KnownTense } from "@/lib/conjugation";

interface CardInfo {
  hebrew: string;
  english: string;
  infinitive: string;
  infinitive_transliteration: string | null;
  binyan: string | null;
}

export default function VerbConjugationPage() {
  const params = useParams();
  const cardId = params.cardId as string;

  const [forms, setForms] = useState<ConjugationForms | null>(null);
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);
  const [knownTenses, setKnownTenses] = useState<KnownTense[]>(["present"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cardsRes, settingsRes] = await Promise.all([
        fetch("/api/cards/all"),
        fetch("/api/settings"),
      ]);
      const cardsData = await cardsRes.json();
      if (!cardsRes.ok) throw new Error("Failed to load card");

      const card = (cardsData.cards ?? []).find(
        (c: { card_id: string }) => c.card_id === cardId
      );
      if (!card) throw new Error("Card not found");
      if (card.word_type !== "verb") throw new Error("Card is not a verb");

      setCardInfo({
        hebrew: card.hebrew,
        english: card.english,
        infinitive: card.grammar_info?.infinitive ?? card.hebrew,
        infinitive_transliteration: card.grammar_info?.infinitive_transliteration ?? null,
        binyan: card.grammar_info?.binyan ?? null,
      });

      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setKnownTenses(s.known_tenses ?? ["present"]);
      }

      // Fetch conjugation table (from cache or generate)
      setGenerating(true);
      const conjRes = await fetch(`/api/conjugation?cardId=${cardId}`);
      if (!conjRes.ok) throw new Error("Failed to load conjugation table");
      const conjData = await conjRes.json();
      setForms(conjData.forms);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  }, [cardId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100 rounded-full animate-spin" />
        <p className="text-sm text-zinc-400">
          {generating ? "Generating conjugation table…" : "Loading…"}
        </p>
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

  if (!forms || !cardInfo) return null;

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <Link
          href="/app/verbs"
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center gap-1"
        >
          ← Verbs
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Learn</span>
        </div>
        <Link
          href={`/app/practice?mode=conjugation&cardId=${cardId}`}
          className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          Practice →
        </Link>
      </div>

      {/* Conjugation table */}
      <ConjugationTable
        forms={forms}
        knownTenses={knownTenses}
        verbHebrew={cardInfo.hebrew}
        verbEnglish={cardInfo.english}
        infinitive={cardInfo.infinitive}
      />
    </div>
  );
}
