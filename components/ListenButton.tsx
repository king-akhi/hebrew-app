"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ListenButtonProps {
  text: string;
  lang?: string;        // BCP-47 language tag, default "he-IL"
  size?: "sm" | "md";
  className?: string;
}

/**
 * Button that reads `text` aloud using the Web Speech API.
 * Falls back silently if the browser doesn't support it.
 */
export default function ListenButton({
  text,
  lang = "he-IL",
  size = "md",
  className = "",
}: ListenButtonProps) {
  const [playing, setPlaying] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Cancel on unmount
  useEffect(() => {
    return () => {
      if (utteranceRef.current) window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;   // slightly slower for learners

    utterance.onstart = () => setPlaying(true);
    utterance.onend   = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [text, lang]);

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const btnSize  = size === "sm"
    ? "p-1 rounded-md"
    : "p-1.5 rounded-lg";

  return (
    <button
      type="button"
      onClick={speak}
      title="Listen"
      aria-label="Listen to pronunciation"
      className={`inline-flex items-center justify-center transition-colors
        text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200
        hover:bg-zinc-100 dark:hover:bg-zinc-800
        ${btnSize} ${className} ${playing ? "text-blue-500 dark:text-blue-400" : ""}`}
    >
      {playing ? (
        /* Animated bars when playing */
        <span className={`flex items-end gap-px ${iconSize}`}>
          <span className="w-px bg-current animate-[bounce_0.6s_ease-in-out_infinite] h-2" />
          <span className="w-px bg-current animate-[bounce_0.6s_ease-in-out_0.15s_infinite] h-3" />
          <span className="w-px bg-current animate-[bounce_0.6s_ease-in-out_0.3s_infinite] h-2" />
        </span>
      ) : (
        /* Speaker icon */
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={iconSize}
          aria-hidden
        >
          <path d="M10 3.75a.75.75 0 0 0-1.264-.546L4.703 7H3.167a.75.75 0 0 0-.75.75v4.5c0 .414.336.75.75.75h1.536l4.033 3.796A.75.75 0 0 0 10 16.25V3.75Z" />
          <path d="M15.95 5.05a.75.75 0 0 0-1.06 1.06A6.5 6.5 0 0 1 16.5 10a6.5 6.5 0 0 1-1.61 4.29.75.75 0 1 0 1.12.998A8 8 0 0 0 18 10a8 8 0 0 0-2.05-5.25.75.75 0 0 0-.001.3Z" />
          <path d="M13.78 7.22a.75.75 0 0 0-1.06 1.06 3.5 3.5 0 0 1 0 4.94.75.75 0 0 0 1.06 1.06 5 5 0 0 0 0-7.06Z" />
        </svg>
      )}
    </button>
  );
}
