"use client";

import { useRef, useState } from "react";

// ── Tag taxonomy ────────────────────────────────────────────────────────────

/** Never shown anywhere */
const LEVEL_TAGS = new Set(["a1", "a2", "b1", "b2"]);

/** Grammar tags — completely hidden from user, only kept in DB for future use */
const GRAMMAR_TAGS = new Set([
  "noun", "verb", "adjective", "adverb", "preposition",
  "conjunction", "pronoun", "expression",
  "masculine", "feminine", "plural-irregular",
  "pa'al", "pi'el", "hif'il", "hitpa'el", "nif'al",
]);

/** Thematic tags from standard vocabulary books */
const THEMATIC_TAGS = new Set([
  "food-drink", "home-furniture", "family-relationships", "body-health",
  "clothing-appearance", "nature-weather", "time-calendar",
  "numbers-quantities", "colors-shapes", "work-professions",
  "transport-travel", "city-places", "shopping-money",
  "education-school", "sports-leisure", "emotions-feelings",
  "religion-culture", "technology", "greetings-expressions",
]);

export function isLevelTag(t: string)    { return LEVEL_TAGS.has(t.toLowerCase()); }
export function isGrammarTag(t: string)  { return GRAMMAR_TAGS.has(t.toLowerCase()); }
export function isThematicTag(t: string) { return THEMATIC_TAGS.has(t.toLowerCase()); }
export function isCustomTag(t: string) {
  const l = t.toLowerCase();
  return !LEVEL_TAGS.has(l) && !GRAMMAR_TAGS.has(l) && !THEMATIC_TAGS.has(l);
}

// ── Component ───────────────────────────────────────────────────────────────

interface TagEditorProps {
  cardId: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagEditor({ cardId, tags, onChange }: TagEditorProps) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Only thematic + custom tags are ever shown to the user
  const userTags = tags.filter((t) => isThematicTag(t) || isCustomTag(t));

  async function saveTags(newUserTags: string[]) {
    setSaving(true);
    try {
      // Preserve grammar + level tags that are invisible to the user
      const hiddenTags = tags.filter((t) => isGrammarTag(t) || isLevelTag(t));
      const merged = [...new Set([...newUserTags, ...hiddenTags])];

      const res = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: merged }),
      });
      if (res.ok) {
        const data = await res.json();
        onChange(data.tags);
      }
    } finally {
      setSaving(false);
    }
  }

  function removeTag(tag: string) {
    saveTags(userTags.filter((t) => t !== tag));
  }

  function addTag() {
    const val = input.trim().toLowerCase();
    if (!val || userTags.map((t) => t.toLowerCase()).includes(val)) {
      setInput("");
      return;
    }
    setInput("");
    saveTags([...userTags, val]);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); addTag(); }
    if (e.key === "Escape") { setEditing(false); setInput(""); }
  }

  function enterEdit() {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // ── Collapsed view ────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {userTags.map((tag) => (
          <span
            key={tag}
            className={`text-xs px-2 py-0.5 rounded-full
              ${isCustomTag(tag)
                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
              }`}
          >
            {tag}
          </span>
        ))}
        <button
          type="button"
          onClick={enterEdit}
          className="text-xs px-2 py-0.5 rounded-full border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:border-zinc-400 transition-colors"
        >
          + tag
        </button>
        {userTags.length > 0 && (
          <button
            type="button"
            onClick={enterEdit}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            Edit
          </button>
        )}
      </div>
    );
  }

  // ── Edit view ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {userTags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
              ${isCustomTag(tag)
                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
              }`}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-red-400 transition-colors leading-none"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New tag… (Enter to confirm)"
          className="flex-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={addTag}
          disabled={!input.trim() || saving}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-40 hover:opacity-80 transition-opacity"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setInput(""); }}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Done
        </button>
      </div>
    </div>
  );
}
