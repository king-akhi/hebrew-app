"use client";

import { useState, useEffect, useRef } from "react";
import AddWordForm from "@/app/app/AddWordForm";

export default function CreateCardModal({
  level,
  open: controlledOpen,
  onClose,
}: {
  level?: "A1" | "A2" | "B1" | "B2";
  open?: boolean;
  onClose?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const close = isControlled ? (onClose ?? (() => {})) : () => setInternalOpen(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {!isControlled && (
        <button
          onClick={() => setInternalOpen(true)}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
        >
          + Create card
        </button>
      )}

      {open && (
        <div
          ref={overlayRef}
          onClick={(e) => { if (e.target === overlayRef.current) close(); }}
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-16 px-4"
        >
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <h2 className="font-semibold text-sm">Create a new card</h2>
              <button
                onClick={() => close()}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <AddWordForm level={level} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
