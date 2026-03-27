-- ============================================================
-- Migration 008 — Example sentence transliteration
-- ============================================================

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS example_sentence_transliteration text;

ALTER TABLE public.system_cards
  ADD COLUMN IF NOT EXISTS example_sentence_transliteration text;
