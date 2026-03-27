-- ============================================================
-- Migration 006 — Feedback table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.feedback (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
    type        text        NOT NULL,
    message     text        NOT NULL,
    page_url    text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT feedback_type_check CHECK (type IN ('bug', 'product'))
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback: insert own" ON public.feedback;
CREATE POLICY "feedback: insert own"
    ON public.feedback FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "feedback: select own" ON public.feedback;
CREATE POLICY "feedback: select own"
    ON public.feedback FOR SELECT TO authenticated
    USING (user_id = auth.uid());
