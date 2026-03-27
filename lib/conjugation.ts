/**
 * Shared types and helpers for Hebrew verb conjugation.
 */

export interface ConjugationForm {
  hebrew: string;
  transliteration: string;
}

export interface ConjugationForms {
  binyan: string;
  base: ConjugationForm;
  present: {
    ms: ConjugationForm;
    fs: ConjugationForm;
    mp: ConjugationForm;
    fp: ConjugationForm;
  };
  past: {
    "1s": ConjugationForm;
    "2sm": ConjugationForm;
    "2sf": ConjugationForm;
    "3sm": ConjugationForm;
    "3sf": ConjugationForm;
    "1p": ConjugationForm;
    "2pm": ConjugationForm;
    "2pf": ConjugationForm;
    "3p": ConjugationForm;
  };
  future: {
    "1s": ConjugationForm;
    "2sm": ConjugationForm;
    "2sf": ConjugationForm;
    "3sm": ConjugationForm;
    "3sf": ConjugationForm;
    "1p": ConjugationForm;
    "2pm": ConjugationForm;
    "2pf": ConjugationForm;
    "3pm": ConjugationForm;
    "3pf": ConjugationForm;
  };
  imperative: {
    "2sm": ConjugationForm;
    "2sf": ConjugationForm;
    "2pm": ConjugationForm;
    "2pf": ConjugationForm;
  };
}

export type KnownTense = "present" | "past" | "future" | "imperative";

export const ALL_TENSES: KnownTense[] = ["present", "past", "future", "imperative"];

export const TENSE_LABELS: Record<KnownTense, string> = {
  present: "Present",
  past: "Past",
  future: "Future",
  imperative: "Imperative",
};

export const TENSE_HEBREW: Record<KnownTense, string> = {
  present: "הווה",
  past: "עבר",
  future: "עתיד",
  imperative: "ציווי",
};

export const PRESENT_PERSONS = ["ms", "fs", "mp", "fp"] as const;
export const PAST_PERSONS = ["1s", "2sm", "2sf", "3sm", "3sf", "1p", "2pm", "2pf", "3p"] as const;
export const FUTURE_PERSONS = ["1s", "2sm", "2sf", "3sm", "3sf", "1p", "2pm", "2pf", "3pm", "3pf"] as const;
export const IMPERATIVE_PERSONS = ["2sm", "2sf", "2pm", "2pf"] as const;

export const PERSON_LABELS: Record<string, string> = {
  // present — no person distinction in Hebrew present
  ms: "Masc. singular",
  fs: "Fem. singular",
  mp: "Masc. plural",
  fp: "Fem. plural",
  // past / future / imperative
  "1s": "I (אני)",
  "2sm": "You m. (אתה)",
  "2sf": "You f. (את)",
  "3sm": "He (הוא)",
  "3sf": "She (היא)",
  "1p": "We (אנחנו)",
  "2pm": "You pl. m. (אתם)",
  "2pf": "You pl. f. (אתן)",
  "3p": "They (הם/הן)",
  "3pm": "They m. (הם)",
  "3pf": "They f. (הן)",
};

// English subject pronouns for exercise generation
export const PERSON_PRONOUNS: Record<string, string> = {
  ms: "he/she/I",
  fs: "she/I",
  mp: "they/we",
  fp: "they/we",
  "1s": "I",
  "2sm": "you (m.)",
  "2sf": "you (f.)",
  "3sm": "he",
  "3sf": "she",
  "1p": "we",
  "2pm": "you all (m.)",
  "2pf": "you all (f.)",
  "3p": "they",
  "3pm": "they (m.)",
  "3pf": "they (f.)",
  "2sm_imp": "you (m.)",
  "2sf_imp": "you (f.)",
  "2pm_imp": "you all (m.)",
  "2pf_imp": "you all (f.)",
};

// Hebrew subject pronouns by person code
export const PERSON_PRONOUNS_HE: Record<string, string> = {
  "1s":  "אני",
  "2sm": "אתה",
  "2sf": "את",
  "3sm": "הוא",
  "3sf": "היא",
  "1p":  "אנחנו",
  "2pm": "אתם",
  "2pf": "אתן",
  "3p":  "הם",
  "3pm": "הם",
  "3pf": "הן",
};

/** Strip nikkud (Hebrew vowel diacritics U+0591–U+05C7) for comparison */
export function stripNikkud(str: string): string {
  return str.replace(/[\u0591-\u05C7]/g, "").trim();
}

/**
 * Compare user Hebrew answer to correct form, ignoring nikkud.
 * Accepts both verb-only ("עושה") and pronoun + verb ("היא עושה").
 */
export function compareHebrew(userAnswer: string, correctForm: string, person?: string): "correct" | "wrong" {
  const normalize = (s: string) => stripNikkud(s).replace(/\s+/g, " ").trim();
  const user = normalize(userAnswer);
  const correct = normalize(correctForm);
  if (!user) return "wrong";
  if (user === correct) return "correct";
  // Also accept pronoun + verb (e.g. "היא עושה" when correct is "עושה")
  if (person) {
    const pronoun = PERSON_PRONOUNS_HE[person];
    if (pronoun && user === `${pronoun} ${correct}`) return "correct";
  }
  return "wrong";
}
