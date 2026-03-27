"use client";

import { useState, useRef, useEffect } from "react";

type FeedbackType = "bug" | "product";

export default function FeedbackModal() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("product");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  function handleClose() {
    setOpen(false);
    setMessage("");
    setType("product");
    setStatus("idle");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message,
          page_url: window.location.pathname,
        }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
      setTimeout(handleClose, 1800);
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        Feedback
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={handleClose}
        />
      )}

      {/* Modal */}
      {open && (
        <div className="fixed z-50 inset-0 flex items-center justify-center px-4 pointer-events-none">
          <div
            className="pointer-events-auto w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Send feedback</h2>
              <button
                onClick={handleClose}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ×
              </button>
            </div>

            {status === "done" ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 text-center py-4">
                Thanks! We got your feedback 🙏
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Type selector */}
                <div className="flex gap-2">
                  {(["product", "bug"] as FeedbackType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${
                        type === t
                          ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                          : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400"
                      }`}
                    >
                      {t === "product" ? "💡 Idea / Feature" : "🐛 Bug"}
                    </button>
                  ))}
                </div>

                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    type === "bug"
                      ? "Describe what happened and how to reproduce it…"
                      : "What would you like to see in the app?"
                  }
                  rows={4}
                  maxLength={2000}
                  className="w-full text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
                />

                {status === "error" && (
                  <p className="text-xs text-red-500">Something went wrong. Please try again.</p>
                )}

                <button
                  type="submit"
                  disabled={!message.trim() || status === "sending"}
                  className="w-full text-sm font-medium py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 disabled:opacity-40 transition-opacity"
                >
                  {status === "sending" ? "Sending…" : "Send"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
