/**
 * GET /api/conjugation/exercises?count=10&cardId=xxx&tenses=present,past
 *
 * Generates conjugation practice exercises.
 * - cardId (optional): restrict to a single verb; if omitted, uses all user verbs
 * - count: number of exercises (default 10, max 30)
 * - tenses: comma-separated list of tenses to include (default: user's known_tenses)
 *
 * Response: { exercises: ConjugationExercise[], empty: boolean }
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  type ConjugationForms,
  type KnownTense,
  PAST_PERSONS,
  FUTURE_PERSONS,
  IMPERATIVE_PERSONS,
  PERSON_LABELS,
} from "@/lib/conjugation";

export interface ConjugationExercise {
  id: string;
  card_id: string;
  verb_hebrew: string;
  verb_english: string;
  infinitive: string;
  tense: KnownTense;
  person: string;
  person_label: string;
  english_prompt: string;   // "she wrote"
  correct_hebrew: string;
  correct_transliteration: string;
  // Exercise interface compat
  english: string;
  category: string;
  hint: string;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── English conjugation helpers ────────────────────────────────

const IRREGULAR_PAST_EN = new Set([
  "brought","thought","taught","bought","caught","fought","sought",
  "went","came","saw","took","gave","said","got","knew","stood","understood",
  "found","told","sent","left","held","kept","felt","meant","built","lost",
  "sat","ran","met","spoke","wrote","drove","rode","rose","chose","froze",
  "threw","grew","drew","flew","blew","swam","rang","sang","began","drank",
  "wore","bore","tore","swore","struck","stuck","won","hung","flung","wove",
]);

function presentThirdSg(base: string): string {
  if (/[^aeiou]y$/.test(base)) return base.slice(0, -1) + "ies";
  if (/(?:s|sh|ch|x|o)$/.test(base)) return base + "es";
  return base + "s";
}

/** Extracts { base, pastForm } from a raw english field like "bring, brought" */
function parseVerbEnglish(verbEnglish: string): { base: string; pastForm: string | null } {
  const parts = verbEnglish.split(/,\s*/).map((p) => p.replace(/^to\s+/i, "").trim().toLowerCase());
  const base = parts[0];
  const pastForm = parts.find((p, i) => i > 0 && (IRREGULAR_PAST_EN.has(p) || p.endsWith("ed"))) ?? null;
  return { base, pastForm };
}

const PRONOUNS: Record<string, string> = {
  // present
  ms: "He", fs: "She", mp: "They (m.)", fp: "They (f.)",
  // past / future
  "1s": "I", "2sm": "You (m.)", "2sf": "You (f.)",
  "3sm": "He", "3sf": "She",
  "1p": "We", "2pm": "You all (m.)", "2pf": "You all (f.)",
  "3p": "They", "3pm": "They (m.)", "3pf": "They (f.)",
  // imperative
  "2sm_imp": "You (m.)", "2sf_imp": "You (f.)",
  "2pm_imp": "You all (m.)", "2pf_imp": "You all (f.)",
};

const THIRD_SG_PERSONS = new Set(["ms", "fs", "3sm", "3sf"]);

function buildEnglishPrompt(verbEnglish: string, person: string, tense: KnownTense): string {
  const { base, pastForm } = parseVerbEnglish(verbEnglish);
  const pronoun = PRONOUNS[person] ?? person;

  if (tense === "present") {
    const verb = THIRD_SG_PERSONS.has(person) ? presentThirdSg(base) : base;
    return `${pronoun} ${verb}`;
  }
  if (tense === "past") {
    const verb = pastForm ?? `${base} (past)`;
    return `${pronoun} ${verb}`;
  }
  if (tense === "future") {
    return `${pronoun} will ${base}`;
  }
  // imperative: just the base verb, directed at the person
  return `${pronoun}, ${base}!`;
}

// ── buildExercise ──────────────────────────────────────────────

function buildExercise(
  cardId: string,
  verbHebrew: string,
  verbEnglish: string,
  infinitive: string,
  tense: KnownTense,
  person: string,
  forms: ConjugationForms,
): ConjugationExercise | null {
  let form: { hebrew: string; transliteration: string } | undefined;

  if (tense === "present") {
    form = (forms.present as Record<string, { hebrew: string; transliteration: string }>)[person];
  } else if (tense === "past") {
    form = (forms.past as Record<string, { hebrew: string; transliteration: string }>)[person];
  } else if (tense === "future") {
    form = (forms.future as Record<string, { hebrew: string; transliteration: string }>)[person];
  } else if (tense === "imperative") {
    form = (forms.imperative as Record<string, { hebrew: string; transliteration: string }>)[person];
  }

  if (!form) return null;

  const personLabel = PERSON_LABELS[person] ?? person;
  const englishPrompt = buildEnglishPrompt(verbEnglish, person, tense);

  return {
    id: `${cardId}-${tense}-${person}-${Date.now()}-${Math.random()}`,
    card_id: cardId,
    verb_hebrew: verbHebrew,
    verb_english: verbEnglish,
    infinitive,
    tense,
    person,
    person_label: personLabel,
    english_prompt: englishPrompt,
    correct_hebrew: form.hebrew,
    correct_transliteration: form.transliteration,
    english: englishPrompt,
    category: `${tense} conjugation`,
    hint: `${personLabel}`,
  };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const cardId = sp.get("cardId");
  const count = Math.min(parseInt(sp.get("count") ?? "10", 10) || 10, 30);

  // Determine active tenses
  let activeTenses: KnownTense[];
  const tensesParam = sp.get("tenses");
  if (tensesParam) {
    activeTenses = tensesParam.split(",").filter((t) =>
      ["present", "past", "future", "imperative"].includes(t)
    ) as KnownTense[];
  } else {
    // Fetch from user profile
    const { data: profile } = await supabase
      .from("users")
      .select("known_tenses")
      .eq("id", user.id)
      .maybeSingle();
    activeTenses = (profile?.known_tenses as KnownTense[]) ?? ["present"];
  }

  if (activeTenses.length === 0) activeTenses = ["present"];

  // Fetch verb cards
  let verbQuery = supabase
    .from("fsrs_state")
    .select("card_id, cards(id, hebrew, english, grammar_info, word_type)")
    .eq("user_id", user.id)
    .eq("direction", "he_to_en");

  if (cardId) {
    verbQuery = verbQuery.eq("card_id", cardId);
  }

  const { data: rows } = await verbQuery;

  const verbCards = (rows ?? [])
    .filter((r) => {
      const c = r.cards as unknown as { word_type?: string } | null;
      return c?.word_type === "verb";
    })
    .map((r) => {
      const c = r.cards as unknown as {
        hebrew: string;
        english: string;
        grammar_info: Record<string, unknown> | null;
      };
      return {
        card_id: r.card_id as string,
        hebrew: c.hebrew,
        english: c.english,
        binyan: (c.grammar_info?.binyan as string) ?? "pa'al",
        infinitive: (c.grammar_info?.infinitive as string) ?? c.hebrew,
      };
    });

  if (verbCards.length === 0) {
    return NextResponse.json({ exercises: [], empty: true });
  }

  // Fetch conjugation tables for all verbs (from cache)
  const tableMap = new Map<string, ConjugationForms>();
  const verbsToFetch = verbCards.filter((v) => !tableMap.has(v.hebrew));

  if (verbsToFetch.length > 0) {
    const { data: cachedTables } = await supabase
      .from("conjugation_tables")
      .select("verb_hebrew, binyan, forms")
      .in("verb_hebrew", verbsToFetch.map((v) => v.hebrew));

    for (const row of cachedTables ?? []) {
      tableMap.set(row.verb_hebrew, row.forms as ConjugationForms);
    }
  }

  // Only use verbs that have cached conjugation tables
  const usableVerbs = verbCards.filter((v) => tableMap.has(v.hebrew));

  if (usableVerbs.length === 0) {
    // No tables cached yet — caller should visit Verbs page first to generate tables
    return NextResponse.json({
      exercises: [],
      empty: true,
      hint: "Visit the Verbs page first to generate conjugation tables.",
    });
  }

  // Build person pools per tense
  const personsByTense: Record<KnownTense, readonly string[]> = {
    present: ["ms", "fs", "mp", "fp"],
    past: PAST_PERSONS,
    future: FUTURE_PERSONS,
    imperative: IMPERATIVE_PERSONS,
  };

  // Generate exercises — deduplicate by (card_id, tense, person)
  const exercises: ConjugationExercise[] = [];
  const usedCombinations = new Set<string>();
  let attempts = 0;
  const maxAttempts = count * 20;

  while (exercises.length < count && attempts < maxAttempts) {
    attempts++;
    const verb = pickRandom(usableVerbs);
    const tense = pickRandom(activeTenses);
    const persons = personsByTense[tense];
    const person = pickRandom(persons);
    const key = `${verb.card_id}-${tense}-${person}`;
    if (usedCombinations.has(key)) continue;

    const forms = tableMap.get(verb.hebrew)!;
    const ex = buildExercise(
      verb.card_id,
      verb.hebrew,
      verb.english,
      verb.infinitive,
      tense,
      person,
      forms,
    );
    if (ex) {
      exercises.push(ex);
      usedCombinations.add(key);
    }
  }

  return NextResponse.json({ exercises, empty: exercises.length === 0 });
}
