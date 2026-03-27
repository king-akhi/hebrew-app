-- ============================================================
-- Hebrew Learning App — Supabase PostgreSQL Migration
-- ============================================================


-- ============================================================
-- 1. TABLES
-- ============================================================

-- organizations
CREATE TABLE public.organizations (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text        NOT NULL,
    plan            text        NOT NULL DEFAULT 'free',
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT organizations_plan_check CHECK (plan IN ('free', 'pro'))
);

-- users (extends auth.users)
CREATE TABLE public.users (
    id               uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id  uuid        NOT NULL REFERENCES public.organizations(id),
    display_name     text,
    level            text        DEFAULT 'A1',
    daily_card_limit int         NOT NULL DEFAULT 20,
    created_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_level_check CHECK (level IN ('A1', 'A2', 'B1', 'B2'))
);

-- decks
CREATE TABLE public.decks (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid        NOT NULL REFERENCES public.organizations(id),
    created_by       uuid        REFERENCES public.users(id),
    name             text        NOT NULL,
    description      text,
    is_system        boolean     NOT NULL DEFAULT false,
    level            text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT decks_level_check CHECK (level IN ('A1', 'A2', 'B1', 'B2'))
);

-- cards
CREATE TABLE public.cards (
    id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id              uuid        NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    hebrew               text        NOT NULL,
    transliteration      text,
    english              text        NOT NULL,
    example_sentence_he  text,
    example_sentence_en  text,
    grammar_notes        text,
    tags                 text[],
    created_at           timestamptz NOT NULL DEFAULT now()
);

-- fsrs_state
CREATE TABLE public.fsrs_state (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    card_id      uuid        NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    stability    float8      NOT NULL DEFAULT 0,
    difficulty   float8      NOT NULL DEFAULT 5,
    due          timestamptz NOT NULL DEFAULT now(),
    last_review  timestamptz,
    reps         int         NOT NULL DEFAULT 0,
    lapses       int         NOT NULL DEFAULT 0,
    state        text        NOT NULL DEFAULT 'new',
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, card_id),
    CONSTRAINT fsrs_state_state_check CHECK (state IN ('new', 'learning', 'review', 'relearning'))
);

-- reviews
CREATE TABLE public.reviews (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    card_id          uuid        NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    rating           int         NOT NULL,
    response_time_ms int,
    reviewed_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT reviews_rating_check CHECK (rating BETWEEN 1 AND 4)
);

-- exercise_sessions
CREATE TABLE public.exercise_sessions (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mode             text        NOT NULL,
    cards_reviewed   int         NOT NULL DEFAULT 0,
    duration_seconds int,
    started_at       timestamptz NOT NULL DEFAULT now(),
    ended_at         timestamptz,
    CONSTRAINT exercise_sessions_mode_check CHECK (mode IN ('vocabulary', 'conjugation', 'writing', 'conversation'))
);

-- correction_logs
CREATE TABLE public.correction_logs (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_id       uuid        REFERENCES public.exercise_sessions(id),
    exercise_text    text        NOT NULL,
    student_answer   text        NOT NULL,
    correction_json  jsonb       NOT NULL,
    model_used       text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT correction_logs_model_check CHECK (model_used IN ('claude-haiku-4-5', 'claude-sonnet-4-6'))
);


-- ============================================================
-- 2. INDEXES
-- ============================================================

-- fsrs_state: fetch cards due for review for a user
CREATE INDEX idx_fsrs_state_user_due
    ON public.fsrs_state (user_id, due);

-- fsrs_state: explicit index on the unique pair (already covered by unique constraint,
-- but making intent explicit for planner)
CREATE INDEX idx_fsrs_state_user_card
    ON public.fsrs_state (user_id, card_id);

-- reviews: time-based queries per user
CREATE INDEX idx_reviews_user_reviewed_at
    ON public.reviews (user_id, reviewed_at);

-- cards: lookup all cards in a deck
CREATE INDEX idx_cards_deck_id
    ON public.cards (deck_id);


-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.organizations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsrs_state         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correction_logs    ENABLE ROW LEVEL SECURITY;

-- Helper: returns the organization_id for the currently authenticated user.
-- SECURITY DEFINER so it can read public.users without hitting RLS recursion.
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT organization_id FROM public.users WHERE id = auth.uid();
$$;

-- ── organizations ──────────────────────────────────────────

-- Users may only see their own organization.
CREATE POLICY "organizations: select own"
    ON public.organizations
    FOR SELECT
    TO authenticated
    USING (id = public.current_user_org_id());

-- Only the service role may insert/update/delete organizations
-- (handled automatically via the trigger below; app clients never do this directly).

-- ── users ──────────────────────────────────────────────────

CREATE POLICY "users: select own row"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "users: update own row"
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ── decks ──────────────────────────────────────────────────

-- Authenticated users may read system decks or decks in their org.
CREATE POLICY "decks: select own org or system"
    ON public.decks
    FOR SELECT
    TO authenticated
    USING (
        is_system = true
        OR organization_id = public.current_user_org_id()
    );

CREATE POLICY "decks: insert own org"
    ON public.decks
    FOR INSERT
    TO authenticated
    WITH CHECK (organization_id = public.current_user_org_id());

CREATE POLICY "decks: update own org"
    ON public.decks
    FOR UPDATE
    TO authenticated
    USING (organization_id = public.current_user_org_id())
    WITH CHECK (organization_id = public.current_user_org_id());

CREATE POLICY "decks: delete own org"
    ON public.decks
    FOR DELETE
    TO authenticated
    USING (organization_id = public.current_user_org_id());

-- ── cards ──────────────────────────────────────────────────

-- A user may access a card when its deck belongs to their org OR the deck is a system deck.
CREATE POLICY "cards: select own org or system deck"
    ON public.cards
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.decks d
            WHERE d.id = cards.deck_id
              AND (d.is_system = true OR d.organization_id = public.current_user_org_id())
        )
    );

CREATE POLICY "cards: insert own org deck"
    ON public.cards
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.decks d
            WHERE d.id = cards.deck_id
              AND d.organization_id = public.current_user_org_id()
        )
    );

CREATE POLICY "cards: update own org deck"
    ON public.cards
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.decks d
            WHERE d.id = cards.deck_id
              AND d.organization_id = public.current_user_org_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.decks d
            WHERE d.id = cards.deck_id
              AND d.organization_id = public.current_user_org_id()
        )
    );

CREATE POLICY "cards: delete own org deck"
    ON public.cards
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.decks d
            WHERE d.id = cards.deck_id
              AND d.organization_id = public.current_user_org_id()
        )
    );

-- ── fsrs_state ─────────────────────────────────────────────

CREATE POLICY "fsrs_state: full access own"
    ON public.fsrs_state
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ── reviews ────────────────────────────────────────────────

CREATE POLICY "reviews: full access own"
    ON public.reviews
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ── exercise_sessions ──────────────────────────────────────

CREATE POLICY "exercise_sessions: full access own"
    ON public.exercise_sessions
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ── correction_logs ────────────────────────────────────────

CREATE POLICY "correction_logs: full access own"
    ON public.correction_logs
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- ============================================================
-- 4. TRIGGER — auto-provision org + user on sign-up
-- ============================================================

-- The function runs as SECURITY DEFINER so it can write to public tables
-- even though the newly created auth.users row has no JWT yet.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_org_id uuid;
BEGIN
    -- 1. Create a personal organization named after the user's email.
    INSERT INTO public.organizations (name, plan)
    VALUES (NEW.email, 'free')
    RETURNING id INTO new_org_id;

    -- 2. Create the public profile row linked to the new organization.
    INSERT INTO public.users (id, organization_id, display_name, level, daily_card_limit)
    VALUES (
        NEW.id,
        new_org_id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'A1',
        20
    );

    RETURN NEW;
END;
$$;

-- Attach the trigger to auth.users (Supabase exposes this table to extensions).
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();
