"use client";

import { useEffect, useState } from "react";

interface Stats {
  streak: number;
  words_mastered: number;
  total_cards: number;
  learning_rate: number;
  heatmap: { date: string; count: number }[];
  today_reviews: number;
  today_practice: number;
  today_cards_added: number;
}

const TOOLTIPS = {
  streak:
    "Consecutive days where you completed at least one activity. One missed day won't break your streak.",
  mastered:
    "Cards reviewed 2+ times with a next-review interval of 5+ days. Grows steadily as you keep up your daily reviews.",
  rate: "Percentage of your vocabulary that is mastered. Mastered ÷ Total cards.",
  heatmap: "Each square = one day. Colour = total reviews + practice exercises done that day.\n1–3 → light · 4–7 → medium · 8+ → dark",
};

function heatmapColor(count: number): string {
  if (count === 0) return "bg-zinc-100 dark:bg-zinc-800";
  if (count <= 3) return "bg-blue-200 dark:bg-blue-900";
  if (count <= 7) return "bg-blue-400 dark:bg-blue-700";
  return "bg-blue-600 dark:bg-blue-500";
}

// Mon=0 … Sun=6 — show M W F S (even indices)
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export default function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [openTip, setOpenTip] = useState<string | null>(null);
  const [reviewSessionDoneToday, setReviewSessionDoneToday] = useState(false);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
    // Check if review session was completed today (set by review page)
    const saved = localStorage.getItem("last_review_session_date");
    const today = new Date().toISOString().substring(0, 10);
    setReviewSessionDoneToday(saved === today);
  }, []);

  useEffect(() => {
    if (!openTip) return;
    function handleClickOutside() { setOpenTip(null); }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openTip]);

  if (!stats) return null;

  const weeks: { date: string; count: number }[][] = [];
  for (let i = 0; i < stats.heatmap.length; i += 7) {
    weeks.push(stats.heatmap.slice(i, i + 7));
  }
  const today = new Date().toISOString().substring(0, 10);

  function toggleTip(key: string) {
    setOpenTip(openTip === key ? null : key);
  }

  const kpis = [
    {
      key: "streak",
      value: `${stats.streak > 0 ? "🔥" : "💤"} ${stats.streak}`,
      label: `day${stats.streak !== 1 ? "s" : ""} streak`,
      tip: TOOLTIPS.streak,
    },
    {
      key: "mastered",
      value: String(stats.words_mastered),
      label: "words mastered",
      tip: TOOLTIPS.mastered,
    },
    {
      key: "rate",
      value: `${stats.learning_rate}%`,
      label: "learning rate",
      tip: TOOLTIPS.rate,
    },
  ];

  return (
    <div className="space-y-2">
      {/* KPIs — compact row */}
      <div className="grid grid-cols-3 gap-2">
        {kpis.map(({ key, value, label, tip }) => (
          <div
            key={key}
            className="relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-3"
          >
            <button
              onClick={(e) => { e.stopPropagation(); toggleTip(key); }}
              className="absolute top-2 right-2 text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 text-xs leading-none"
              aria-label="Info"
            >
              ⓘ
            </button>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{label}</p>
            {openTip === key && (
              <div className="absolute z-10 top-full left-0 mt-1 w-64 text-xs bg-zinc-800 dark:bg-zinc-700 text-zinc-100 rounded-lg px-3 py-2 shadow-lg">
                {tip}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Heatmap + Today's goals — side by side */}
      <div className="grid grid-cols-2 gap-2">

        {/* Heatmap */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              Activity
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); toggleTip("heatmap"); }}
              className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 text-xs leading-none relative"
              aria-label="Info"
            >
              ⓘ
              {openTip === "heatmap" && (
                <div className="absolute z-10 bottom-full left-0 mb-1 w-56 text-xs bg-zinc-800 dark:bg-zinc-700 text-zinc-100 rounded-lg px-3 py-2 shadow-lg whitespace-pre-line text-left font-normal normal-case tracking-normal">
                  {TOOLTIPS.heatmap}
                </div>
              )}
            </button>
          </div>
          <div className="flex gap-1 overflow-x-auto">
            <div className="flex flex-col gap-1 mr-1">
              {DAY_LABELS.map((d, i) => (
                <span key={i} className="text-[9px] text-zinc-300 dark:text-zinc-600 h-3 flex items-center w-2">
                  {i % 2 === 0 ? d : ""}
                </span>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date} — ${day.count} action${day.count !== 1 ? "s" : ""}`}
                    className={`w-3 h-3 rounded-sm shrink-0 ${heatmapColor(day.count)} ${
                      day.date === today ? "ring-1 ring-zinc-400 dark:ring-zinc-500" : ""
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 justify-end">
            <span className="text-[10px] text-zinc-400">Less</span>
            {[0, 2, 5, 9].map((c) => (
              <div key={c} className={`w-2.5 h-2.5 rounded-sm ${heatmapColor(c)}`} />
            ))}
            <span className="text-[10px] text-zinc-400">More</span>
          </div>
        </div>

        {/* Today's goals */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-3 space-y-2">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            Today&apos;s goals
          </p>
          {[
            {
              done: stats.today_cards_added >= 5,
              label: stats.today_cards_added >= 5
                ? `${stats.today_cards_added} cards added`
                : `Add 5 cards (${stats.today_cards_added}/5)`,
            },
            {
              done: reviewSessionDoneToday,
              label: reviewSessionDoneToday
                ? "Review session complete"
                : stats.today_reviews > 0
                ? `In progress (${stats.today_reviews} done)`
                : "Complete a review session",
            },
            {
              done: stats.today_practice > 0,
              label: stats.today_practice > 0
                ? `${stats.today_practice} exercise${stats.today_practice > 1 ? "s" : ""} done`
                : "Do a practice exercise",
            },
          ].map(({ done, label }, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`w-4 h-4 rounded flex items-center justify-center border-2 shrink-0 transition-colors ${
                  done ? "bg-blue-600 border-blue-600" : "border-zinc-300 dark:border-zinc-600"
                }`}
              >
                {done && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className={`text-xs ${done ? "line-through text-zinc-400 dark:text-zinc-500" : "text-zinc-700 dark:text-zinc-300"}`}>
                {label}
              </span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
