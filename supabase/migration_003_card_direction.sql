-- Migration 003 — Bidirectional review via fsrs_state direction
-- Run in Supabase SQL Editor.

-- 1. Add direction column to fsrs_state
ALTER TABLE public.fsrs_state
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'he_to_en'
  CONSTRAINT fsrs_state_direction_check CHECK (direction IN ('he_to_en', 'en_to_he'));

-- 2. Drop old unique constraint (user_id, card_id) and replace with (user_id, card_id, direction)
--    The old constraint name is auto-generated — drop it by column pattern:
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.fsrs_state'::regclass
    AND contype = 'u'
    AND conkey = ARRAY(
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'public.fsrs_state'::regclass
        AND attname IN ('user_id','card_id')
      ORDER BY attnum
    );
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.fsrs_state DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END $$;

ALTER TABLE public.fsrs_state
  DROP CONSTRAINT IF EXISTS fsrs_state_user_card_dir_key;

ALTER TABLE public.fsrs_state
  ADD CONSTRAINT fsrs_state_user_card_dir_key UNIQUE (user_id, card_id, direction);

-- 3. Not needed on cards table
ALTER TABLE public.cards DROP COLUMN IF EXISTS review_direction;
