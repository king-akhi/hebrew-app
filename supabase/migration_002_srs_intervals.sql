-- ============================================================
-- Migration 002 — Custom SRS intervals per user
-- ============================================================
-- Run this in the Supabase SQL editor.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS srs_again_minutes int  NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS srs_hard_hours    real NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS srs_good_days     int  NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS srs_easy_days     int  NOT NULL DEFAULT 7;
