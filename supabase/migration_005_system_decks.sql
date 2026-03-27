-- ============================================================
-- Migration 005 — System cards cache + pending conjugation tables
-- Run in Supabase SQL Editor.
-- ============================================================


-- ── 1. Fix correction_logs model constraint ─────────────────

ALTER TABLE public.correction_logs
  DROP CONSTRAINT IF EXISTS correction_logs_model_check;

ALTER TABLE public.correction_logs
  ADD CONSTRAINT correction_logs_model_check
  CHECK (model_used IN (
    'claude-haiku-4-5',
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6'
  ));


-- ── 2. Conjugation tables ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conjugation_tables (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    verb_hebrew  text        NOT NULL,
    binyan       text        NOT NULL,
    forms        jsonb       NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT conjugation_tables_verb_binyan_key UNIQUE (verb_hebrew, binyan)
);

ALTER TABLE public.conjugation_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conjugation_tables: select all authenticated" ON public.conjugation_tables;
CREATE POLICY "conjugation_tables: select all authenticated"
    ON public.conjugation_tables FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "conjugation_tables: insert authenticated" ON public.conjugation_tables;
CREATE POLICY "conjugation_tables: insert authenticated"
    ON public.conjugation_tables FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "conjugation_tables: upsert authenticated" ON public.conjugation_tables;
CREATE POLICY "conjugation_tables: upsert authenticated"
    ON public.conjugation_tables FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


-- ── 3. users.known_tenses ────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS known_tenses text[] NOT NULL DEFAULT ARRAY['present'];


-- ── 4. conjugation_logs ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conjugation_logs (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    verb_hebrew   text        NOT NULL,
    score_correct int         NOT NULL DEFAULT 0,
    score_total   int         NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conjugation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conjugation_logs: full access own" ON public.conjugation_logs;
CREATE POLICY "conjugation_logs: full access own"
    ON public.conjugation_logs FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ── 5. system_cards ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.system_cards (
    id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    hebrew               text        NOT NULL,
    transliteration      text,
    english              text        NOT NULL,
    example_sentence_he  text,
    example_sentence_en  text,
    grammar_notes        text,
    word_type            text,
    grammar_info         jsonb,
    tags                 text[]      NOT NULL DEFAULT '{}',
    level                text,
    system_deck          text,
    created_at           timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT system_cards_english_key UNIQUE (english),
    CONSTRAINT system_cards_level_check CHECK (level IN ('A1', 'A2', 'B1', 'B2'))
);

CREATE INDEX IF NOT EXISTS idx_system_cards_english
    ON public.system_cards (lower(english));

CREATE INDEX IF NOT EXISTS idx_system_cards_hebrew
    ON public.system_cards (hebrew);

CREATE INDEX IF NOT EXISTS idx_system_cards_system_deck
    ON public.system_cards (system_deck)
    WHERE system_deck IS NOT NULL;

ALTER TABLE public.system_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_cards: select all authenticated" ON public.system_cards;
CREATE POLICY "system_cards: select all authenticated"
    ON public.system_cards FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "system_cards: insert authenticated" ON public.system_cards;
CREATE POLICY "system_cards: insert authenticated"
    ON public.system_cards FOR INSERT TO authenticated WITH CHECK (true);


-- ── 6. cards — colonnes manquantes ──────────────────────────

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS word_type    text,
  ADD COLUMN IF NOT EXISTS grammar_info jsonb;
