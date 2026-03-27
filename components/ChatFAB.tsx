"use client";

/**
 * Chat AI floating action button — v1 placeholder.
 * Visible on all pages, grayed out with "Coming soon" tooltip.
 * No functionality in v1.
 */
export default function ChatFAB() {
  return (
    <div className="fixed bottom-5 right-5 z-50 group">
      <button
        disabled
        title="AI Tutor — coming soon"
        className="w-13 h-13 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 shadow-lg flex items-center justify-center cursor-not-allowed transition-all"
        style={{ width: 52, height: 52 }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M8 10h.01M12 10h.01M16 10h.01" />
        </svg>
      </button>
      {/* Tooltip */}
      <div className="absolute bottom-full right-0 mb-2 px-2.5 py-1 rounded-lg bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        AI Tutor — coming soon
      </div>
    </div>
  );
}
