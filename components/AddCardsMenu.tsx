"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import CreateCardModal from "@/components/CreateCardModal";
import BatchAddModal from "@/components/BatchAddModal";

type Mode = "menu" | "create" | "batch";

export default function AddCardsMenu({
  level,
}: {
  level?: "A1" | "A2" | "B1" | "B2";
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (mode !== "menu") return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMode(null);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [mode]);

  return (
    <>
      {/* Trigger */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMode((m) => (m === "menu" ? null : "menu"))}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
        >
          + Add new cards
        </button>

        {mode === "menu" && (
          <div className="absolute right-0 top-full mt-1.5 z-30 w-48 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 overflow-hidden">
            <button
              onClick={() => setMode("create")}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <span className="font-medium">One card</span>
              <p className="text-xs text-zinc-400 mt-0.5">Add a single word manually</p>
            </button>
            <button
              onClick={() => setMode("batch")}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <span className="font-medium">Several cards</span>
              <p className="text-xs text-zinc-400 mt-0.5">Generate a batch by theme</p>
            </button>
            <button
              onClick={() => { setMode(null); router.push("/app/system-decks"); }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <span className="font-medium">Explore decks</span>
              <p className="text-xs text-zinc-400 mt-0.5">Browse curated word lists</p>
            </button>
          </div>
        )}
      </div>

      {/* Controlled modals */}
      <CreateCardModal
        level={level}
        open={mode === "create"}
        onClose={() => setMode(null)}
      />
      <BatchAddModal
        level={level}
        open={mode === "batch"}
        onClose={() => setMode(null)}
      />
    </>
  );
}
