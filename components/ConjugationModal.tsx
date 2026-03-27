"use client";

import { useState, useEffect } from "react";
import ConjugationTable from "@/components/ConjugationTable";
import type { ConjugationForms, KnownTense } from "@/lib/conjugation";

interface Props {
  cardId: string;
  verbHebrew: string;
  verbEnglish: string;
  infinitive: string;
  onClose: () => void;
}

export default function ConjugationModal({ cardId, verbHebrew, verbEnglish, infinitive, onClose }: Props) {
  const [forms, setForms] = useState<ConjugationForms | null>(null);
  const [knownTenses, setKnownTenses] = useState<KnownTense[]>(["present"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [conjRes, settingsRes] = await Promise.all([
          fetch(`/api/conjugation?cardId=${cardId}`),
          fetch("/api/settings"),
        ]);
        if (!conjRes.ok) throw new Error("Failed to load conjugation table");
        const conjData = await conjRes.json();
        setForms(conjData.forms);
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          setKnownTenses(s.known_tenses ?? ["present"]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [cardId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div>
            <h2 className="text-base font-semibold">Conjugation</h2>
            <p className="text-xs text-zinc-400 mt-0.5" dir="rtl" lang="he">{verbHebrew}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100 rounded-full animate-spin" />
              <p className="text-sm text-zinc-400">Generating conjugation table…</p>
            </div>
          )}
          {error && (
            <p className="text-sm text-red-500 text-center py-8">{error}</p>
          )}
          {!loading && !error && forms && (
            <ConjugationTable
              forms={forms}
              knownTenses={knownTenses}
              verbHebrew={verbHebrew}
              verbEnglish={verbEnglish}
              infinitive={infinitive}
            />
          )}
        </div>
      </div>
    </div>
  );
}
