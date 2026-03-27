"use client";

import {
  type ConjugationForms,
  type KnownTense,
  TENSE_LABELS,
  TENSE_HEBREW,
  PERSON_LABELS,
  PAST_PERSONS,
  FUTURE_PERSONS,
  IMPERATIVE_PERSONS,
} from "@/lib/conjugation";
import ListenButton from "@/components/ListenButton";

// Maps each person label to the correct present-tense form key (ms/fs/mp/fp).
// Hebrew present doesn't distinguish person — ms covers I/you/he, fs covers I/you/she, etc.
const PRESENT_PERSON_ROWS: { label: string; key: "ms" | "fs" | "mp" | "fp" }[] = [
  { label: "I (אני) m.",       key: "ms" },
  { label: "I (אני) f.",       key: "fs" },
  { label: "You m. (אתה)",     key: "ms" },
  { label: "You f. (את)",      key: "fs" },
  { label: "He (הוא)",         key: "ms" },
  { label: "She (היא)",        key: "fs" },
  { label: "We m. (אנחנו)",    key: "mp" },
  { label: "We f. (אנחנו)",    key: "fp" },
  { label: "You pl. m. (אתם)", key: "mp" },
  { label: "You pl. f. (אתן)", key: "fp" },
  { label: "They m. (הם)",     key: "mp" },
  { label: "They f. (הן)",     key: "fp" },
];

interface Props {
  forms: ConjugationForms;
  knownTenses: KnownTense[];
  verbHebrew: string;
  verbEnglish: string;
  infinitive: string;
}

function FormCell({ form }: { form: { hebrew: string; transliteration: string } }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-base font-medium" dir="rtl" lang="he">
        {form.hebrew}
      </span>
      <span className="text-xs text-zinc-400">{form.transliteration}</span>
    </div>
  );
}

function TenseSection({
  tense,
  forms,
  locked,
}: {
  tense: KnownTense;
  forms: ConjugationForms;
  locked: boolean;
}) {
  return (
    <div className={`rounded-xl border overflow-hidden transition-opacity ${locked ? "opacity-40" : ""} border-zinc-200 dark:border-zinc-800`}>
      {/* Tense header */}
      <div className="px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/60 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{TENSE_LABELS[tense]}</span>
          <span className="text-xs text-zinc-400" dir="rtl" lang="he">{TENSE_HEBREW[tense]}</span>
        </div>
        {locked && (
          <span className="text-xs text-zinc-400 italic">Locked — unlock in Verbs</span>
        )}
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {tense === "present" && PRESENT_PERSON_ROWS.map(({ label, key }) => (
          <div key={label} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">{label}</span>
            <div className="flex items-center gap-2">
              <FormCell form={forms.present[key]} />
              <ListenButton text={forms.present[key].hebrew} size="sm" />
            </div>
          </div>
        ))}

        {tense === "past" && PAST_PERSONS.map((p) => (
          <div key={p} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">{PERSON_LABELS[p]}</span>
            <div className="flex items-center gap-2">
              <FormCell form={forms.past[p]} />
              <ListenButton text={forms.past[p].hebrew} size="sm" />
            </div>
          </div>
        ))}

        {tense === "future" && FUTURE_PERSONS.map((p) => (
          <div key={p} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">{PERSON_LABELS[p]}</span>
            <div className="flex items-center gap-2">
              <FormCell form={forms.future[p]} />
              <ListenButton text={forms.future[p].hebrew} size="sm" />
            </div>
          </div>
        ))}

        {tense === "imperative" && IMPERATIVE_PERSONS.map((p) => (
          <div key={p} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">{PERSON_LABELS[p]}</span>
            <div className="flex items-center gap-2">
              <FormCell form={forms.imperative[p]} />
              <ListenButton text={forms.imperative[p].hebrew} size="sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ConjugationTable({ forms, knownTenses, verbHebrew, verbEnglish, infinitive }: Props) {
  const tenses: KnownTense[] = ["present", "past", "future", "imperative"];

  return (
    <div className="space-y-4">
      {/* Verb header */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-medium" dir="rtl" lang="he">{infinitive}</span>
            <ListenButton text={infinitive} size="md" />
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            to {verbEnglish}
            {forms.binyan && (
              <span className="ml-2 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full">
                {forms.binyan}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Tense sections */}
      {tenses.map((tense) => (
        <TenseSection
          key={tense}
          tense={tense}
          forms={forms}
          locked={!knownTenses.includes(tense)}
        />
      ))}
    </div>
  );
}
