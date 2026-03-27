"use client";

import confetti from "canvas-confetti";

export function useConfetti() {
  function burst() {
    if (typeof window === "undefined") return;
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.55 },
      colors: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"],
      disableForReducedMotion: true,
    });
  }

  return { burst };
}
