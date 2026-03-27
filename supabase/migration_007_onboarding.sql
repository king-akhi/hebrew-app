-- ============================================================
-- Migration 007 — Onboarding flag
-- ============================================================

-- Add onboarding_completed with DEFAULT true so all existing users
-- are considered already onboarded. New users get false via the trigger.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT true;

-- Update the signup trigger to set onboarding_completed = false for new users.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_org_id uuid;
BEGIN
    INSERT INTO public.organizations (name, plan)
    VALUES (NEW.email, 'free')
    RETURNING id INTO new_org_id;

    INSERT INTO public.users (id, organization_id, display_name, level, daily_card_limit, onboarding_completed)
    VALUES (
        NEW.id,
        new_org_id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'A1',
        20,
        false
    );

    RETURN NEW;
END;
$$;
