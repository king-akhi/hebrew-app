-- migration_004_user_notes.sql
-- Add user_notes column to cards table for personal annotations per card.

ALTER TABLE cards ADD COLUMN IF NOT EXISTS user_notes text;
