"use client";

export function useSound() {
  function playSuccess() {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("sound_enabled") === "false") return;
    try {
      const AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof window.AudioContext })
          .webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();

      // Two-note ascending chime: C5 (523 Hz) → E5 (659 Hz)
      const notes = [
        { freq: 523.25, start: 0, duration: 0.25 },
        { freq: 659.25, start: 0.14, duration: 0.35 },
      ];

      for (const { freq, start, duration } of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = "sine";
        osc.frequency.value = freq;

        const t = ctx.currentTime + start;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.start(t);
        osc.stop(t + duration);
      }
    } catch {
      // Silently ignore — sound is non-critical
    }
  }

  return { playSuccess };
}
