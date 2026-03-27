"use client";

import { useEffect, useState } from "react";

interface Settings {
  daily_card_limit: number;
  srs_again_minutes: number;
  srs_hard_hours: number;
  srs_good_days: number;
  srs_easy_days: number;
}

const DEFAULTS: Settings = {
  daily_card_limit: 20,
  srs_again_minutes: 5,
  srs_hard_hours: 8,
  srs_good_days: 2,
  srs_easy_days: 7,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    setSoundEnabled(localStorage.getItem("sound_enabled") !== "false");
  }, []);

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("sound_enabled", next ? "true" : "false");
  }

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings({ ...DEFAULTS, ...data });
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load settings.");
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      setError("Save failed. Please try again.");
    }
  }

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-400 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-10 max-w-lg">
      <h1 className="text-xl font-semibold">Settings</h1>

      {/* ── Daily limit ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Daily limit</h2>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Daily card limit</span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={settings.daily_card_limit}
              onChange={(e) => set("daily_card_limit", Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-12 text-sm text-right font-mono">{settings.daily_card_limit}</span>
          </div>
        </label>
      </section>

      {/* ── Preferences ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Preferences</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Sound effects</p>
            <p className="text-xs text-zinc-400 mt-0.5">Chime on correct answers, confetti on session complete</p>
          </div>
          <button
            type="button"
            onClick={toggleSound}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
              soundEnabled ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                soundEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </section>

      {/* ── SRS Intervals ── */}
      <section className="space-y-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
            Review intervals
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Applied when you see a card for the first time.
          </p>
        </div>

        <IntervalField
          label="Again"
          description="Missed — review again soon"
          value={settings.srs_again_minutes}
          min={1}
          max={60}
          step={1}
          unit="min"
          onChange={(v) => set("srs_again_minutes", v)}
        />

        <IntervalField
          label="Hard"
          description="Struggled — review later today"
          value={settings.srs_hard_hours}
          min={1}
          max={24}
          step={0.5}
          unit="h"
          onChange={(v) => set("srs_hard_hours", v)}
        />

        <IntervalField
          label="Good"
          description="Remembered with some effort"
          value={settings.srs_good_days}
          min={1}
          max={14}
          step={1}
          unit="days"
          onChange={(v) => set("srs_good_days", v)}
        />

        <IntervalField
          label="Easy"
          description="Remembered immediately"
          value={settings.srs_easy_days}
          min={3}
          max={30}
          step={1}
          unit="days"
          onChange={(v) => set("srs_easy_days", v)}
        />
      </section>

      {/* ── Save ── */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 text-white px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-sm text-green-600 dark:text-green-400">Saved!</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  );
}

// ── Reusable interval row ────────────────────────────────────────────────────

function IntervalField({
  label,
  description,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  // Badge colour per rating
  const colours: Record<string, string> = {
    Again: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    Hard:  "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
    Good:  "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    Easy:  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colours[label]}`}>
          {label}
        </span>
        <span className="text-xs text-zinc-400">{description}</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-20 text-sm text-right font-mono">
          {value} {unit}
        </span>
      </div>
    </div>
  );
}
