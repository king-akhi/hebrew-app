"use client";

import Link from "next/link";
import ListenButton from "@/components/ListenButton";

interface VerbInfo {
  infinitive?: string;
  infinitive_transliteration?: string;
  binyan?: string;
  root?: string;
}

interface NounInfo {
  gender?: "masculine" | "feminine";
  plural?: string;
}

interface AdjectiveInfo {
  ms?: string;
  fs?: string;
  mp?: string;
  fp?: string;
}

type GrammarInfo = VerbInfo & NounInfo & AdjectiveInfo;

export default function GrammarBox({
  wordType,
  grammarInfo,
  fallback,
  cardId,
}: {
  wordType: string | null;
  grammarInfo: GrammarInfo | null;
  fallback?: string | null;
  cardId?: string;
}) {
  if (wordType === "verb" && grammarInfo) {
    return (
      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-4 py-3 space-y-2.5">
        {(grammarInfo.binyan || grammarInfo.root) && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {grammarInfo.binyan && (
              <span className="capitalize font-medium text-zinc-600 dark:text-zinc-300">
                {grammarInfo.binyan}
              </span>
            )}
            {grammarInfo.binyan && grammarInfo.root && (
              <span className="text-zinc-300 dark:text-zinc-600 mx-2">·</span>
            )}
            {grammarInfo.root && (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-xs text-zinc-400 dark:text-zinc-500">root</span>
                <span dir="rtl" lang="he" className="font-medium text-base text-zinc-700 dark:text-zinc-200">
                  {grammarInfo.root}
                </span>
                <ListenButton text={grammarInfo.root} size="sm" />
              </span>
            )}
          </p>
        )}
        {cardId ? (
          <Link
            href={`/app/verbs/${cardId}`}
            className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            → Full conjugation table
          </Link>
        ) : (
          <span className="text-xs text-zinc-300 dark:text-zinc-600 select-none">
            → Full conjugation table
          </span>
        )}
      </div>
    );
  }

  if (wordType === "noun" && grammarInfo) {
    const { gender, plural } = grammarInfo;
    if (!gender && !plural) return fallback ? <GrammarFallback text={fallback} /> : null;
    return (
      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-4 py-3 flex items-center gap-3">
        {gender && (
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
              gender === "masculine"
                ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                : "bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300"
            }`}
          >
            {gender}
          </span>
        )}
        {plural && (
          <span className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span>plural:</span>
            <span className="font-medium text-base text-zinc-700 dark:text-zinc-200" dir="rtl" lang="he">
              {plural}
            </span>
            <ListenButton text={plural} size="sm" />
          </span>
        )}
      </div>
    );
  }

  if (wordType === "adjective" && grammarInfo) {
    const forms = [
      { label: "masc. sg.", value: grammarInfo.ms },
      { label: "fem. sg.", value: grammarInfo.fs },
      { label: "masc. pl.", value: grammarInfo.mp },
      { label: "fem. pl.", value: grammarInfo.fp },
    ].filter((f) => f.value);
    if (forms.length === 0) return fallback ? <GrammarFallback text={fallback} /> : null;
    return (
      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-4 py-3">
        <div className="grid grid-cols-4 gap-3 text-center">
          {forms.map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">{label}</p>
              <p className="font-medium text-base text-zinc-700 dark:text-zinc-200" dir="rtl" lang="he">
                {value}
              </p>
              <ListenButton text={value!} size="sm" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (fallback) return <GrammarFallback text={fallback} />;
  return null;
}

function GrammarFallback({ text }: { text: string }) {
  return (
    <p className="text-sm text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800 rounded-lg px-4 py-3">
      {text}
    </p>
  );
}
