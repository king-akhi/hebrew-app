"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import ListenButton from "@/components/ListenButton";
import CreateCardModal from "@/components/CreateCardModal";
import TagEditor, { isThematicTag, isCustomTag } from "@/components/TagEditor";
import EditableField from "@/components/EditableField";
import GrammarBox from "@/components/GrammarBox";
import { ClickableHebrew } from "@/components/HebrewWord";

interface VocabCard {
  card_id: string;
  total_reps: number;
  state: string;
  hebrew: string;
  transliteration: string | null;
  english: string;
  example_sentence_he: string | null;
  example_sentence_en: string | null;
  grammar_notes: string | null;
  word_type: string | null;
  grammar_info: Record<string, unknown> | null;
  user_notes: string | null;
  tags: string[];
}


export default function VocabularyPage() {
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cards/all");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load vocabulary");
      setCards(data.cards);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vocabulary");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCards(); }, [loadCards]);

  function handleFieldSave(cardId: string, field: string, value: string | null) {
    setCards((prev) =>
      prev.map((c) => (c.card_id === cardId ? { ...c, [field]: value } : c))
    );
  }

  async function handleDelete(cardId: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setCards((prev) => prev.filter((c) => c.card_id !== cardId));
      setExpanded(null);
      setConfirmDelete(null);
    } catch {
      // silently ignore — card stays in list
    } finally {
      setDeleting(false);
    }
  }

  function handleTagsChange(cardId: string, newTags: string[]) {
    setCards((prev) =>
      prev.map((c) => (c.card_id === cardId ? { ...c, tags: newTags } : c))
    );
  }

  // Collect all thematic+custom tags across cards for the filter bar
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards) {
      for (const t of c.tags) {
        if (isThematicTag(t) || isCustomTag(t)) set.add(t);
      }
    }
    return Array.from(set).sort();
  }, [cards]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return cards.filter((c) => {
      const matchSearch =
        !q ||
        c.hebrew.includes(q) ||
        c.english.toLowerCase().includes(q) ||
        (c.transliteration?.toLowerCase().includes(q) ?? false);
      const matchTag = !filterTag || c.tags.includes(filterTag);
      return matchSearch && matchTag;
    });
  }, [cards, search, filterTag]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-400">Loading vocabulary…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-500 text-sm">{error}</p>
        <button onClick={loadCards} className="text-sm underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Vocabulary</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {cards.length} card{cards.length !== 1 ? "s" : ""}
          </p>
        </div>
        <CreateCardModal />
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search Hebrew, transliteration, or English…"
        className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
      />

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterTag(null)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filterTag === null
                ? "bg-blue-600 text-white border-blue-600"
                : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500"
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filterTag === tag
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Card list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-400 text-sm">No cards match your search.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((card) => {
            const isOpen = expanded === card.card_id;
            const visibleTags = card.tags.filter(
              (t) => isThematicTag(t) || isCustomTag(t)
            );

            return (
              <div
                key={card.card_id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
              >
                {/* Row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : card.card_id)}
                  className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3">
                      <span className="text-lg font-medium" dir="rtl" lang="he">
                        {card.word_type === "verb" && card.grammar_info?.infinitive
                          ? card.grammar_info.infinitive as string
                          : card.hebrew}
                      </span>
                      {(card.word_type === "verb" && card.grammar_info?.infinitive_transliteration
                        ? card.grammar_info.infinitive_transliteration as string
                        : card.transliteration) && (
                        <span className="text-sm text-zinc-400 truncate">
                          {card.word_type === "verb" && card.grammar_info?.infinitive_transliteration
                            ? card.grammar_info.infinitive_transliteration as string
                            : card.transliteration}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-0.5 truncate">
                      {card.english}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {visibleTags.slice(0, 2).map((t) => (
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
                    <span className="text-zinc-300 dark:text-zinc-600 text-sm">
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-5 pb-5 space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                    {/* Example sentence */}
                    {card.example_sentence_he && (
                      <div className="space-y-1">
                        <div className="flex items-start justify-end gap-2">
                          <ListenButton text={card.example_sentence_he} size="sm" />
                          <ClickableHebrew text={card.example_sentence_he} className="text-base" />
                        </div>
                        {card.example_sentence_en && (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {card.example_sentence_en}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Grammar info */}
                    <GrammarBox
                      wordType={card.word_type}
                      grammarInfo={card.grammar_info as Parameters<typeof GrammarBox>[0]["grammarInfo"]}
                      fallback={card.grammar_notes}
                      cardId={card.word_type === "verb" ? card.card_id : undefined}
                    />

                    {/* User notes (editable) */}
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

                    {/* Tags (editable) */}
                    <TagEditor
                      cardId={card.card_id}
                      tags={card.tags ?? []}
                      onChange={(newTags) => handleTagsChange(card.card_id, newTags)}
                    />

                    {/* Delete */}
                    <div className="flex justify-end pt-1">
                      {confirmDelete === card.card_id ? (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-zinc-500">Delete this card?</span>
                          <button
                            onClick={() => handleDelete(card.card_id)}
                            disabled={deleting}
                            className="text-xs text-red-600 dark:text-red-400 font-medium hover:underline disabled:opacity-50"
                          >
                            {deleting ? "Deleting…" : "Yes, delete"}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs text-zinc-400 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(card.card_id)}
                          className="text-xs text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                        >
                          Delete card
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
