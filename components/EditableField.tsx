"use client";

import { useRef, useState } from "react";

interface EditableFieldProps {
  cardId: string;
  field: "transliteration" | "english" | "grammar_notes" | "user_notes" | "example_sentence_he" | "example_sentence_en";
  value: string | null;
  display?: React.ReactNode; // custom render when not editing; falls back to value
  className?: string;
  inputClassName?: string;
  onSave: (newValue: string | null) => void;
}

export default function EditableField({
  cardId,
  field,
  value,
  display,
  className = "",
  inputClassName = "",
  onSave,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(value ?? "");
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 30);
  }

  async function save() {
    const trimmed = draft.trim() || null;
    if (trimmed === (value ?? null)) { setEditing(false); return; }
    setSaving(true);
    try {
      await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: trimmed }),
      });
      onSave(trimmed);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") { setEditing(false); }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className={`bg-transparent border-b border-blue-400 focus:outline-none disabled:opacity-50 ${inputClassName}`}
      />
    );
  }

  return (
    <span className={`group inline-flex items-center gap-1.5 ${className}`}>
      {display ?? <span>{value}</span>}
      <button
        type="button"
        onClick={startEdit}
        title={`Edit ${field}`}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
          <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.79 2.291a.75.75 0 0 0 .95.95l2.29-.79a2.75 2.75 0 0 0 .892-.596l4.262-4.263a1.75 1.75 0 0 0 0-2.475ZM4.5 13.25a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-7Z" />
        </svg>
      </button>
    </span>
  );
}
