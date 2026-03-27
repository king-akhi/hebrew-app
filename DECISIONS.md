# Architecture Decisions

## D001 — Multi-tenant from day one (organizations table)
**Decision:** Every user belongs to an `organization`, even in B2C (organization of size 1).
**Reason:** Allows future B2B expansion (schools, corporate) without a schema migration. The cost at B2C scale is negligible (one extra row per user).
**Date:** 2026-03-23

## D002 — FSRS-5 as the SRS algorithm
**Decision:** Use FSRS-5 (Free Spaced Repetition Scheduler), ported to TypeScript.
**Reason:** Scientifically superior to SM-2 (Anki's algorithm). Open-source, well-documented, no licensing issues. The accumulated FSRS profile (stability/difficulty per card) is the core moat of the product.
**Date:** 2026-03-23

## D003 — Haiku for card generation, Sonnet for pedagogical correction
**Decision:** Use `claude-haiku-4-5-20251001` for card generation (with aggressive prompt caching), `claude-sonnet-4-6` for real-time exercise correction.
**Reason:** Card generation is high-volume and latency-tolerant — Haiku + cache keeps costs near zero. Correction is low-volume and quality-critical — Sonnet gives better pedagogical explanations.
**Date:** 2026-03-23

## D004 — Supabase for DB, Auth, and RLS
**Decision:** Use Supabase (Postgres + Auth + Row Level Security) as the primary data store.
**Reason:** RLS enforces data isolation at the DB level, eliminating an entire class of authorization bugs. Built-in Auth avoids rolling our own JWT handling. Supabase's `service_role` key bypasses RLS for background workers (card generation, FSRS scheduling).
**Date:** 2026-03-23

## D005 — daily_card_limit stored on users row, not computed
**Decision:** Store `daily_card_limit` (int) directly on `public.users` rather than computing it from `organizations.plan` at query time.
**Reason:** Simplifies hot-path queries (no join needed to enforce the limit). Updated by a webhook/function when the org's plan changes (Stripe webhook → update org plan → update user limit).
**Implication:** A Stripe webhook must keep this field in sync when plan changes. See D004 for the service_role pattern.
**Date:** 2026-03-23

## D006 — Correction prompt validated against 30 test cases (28/30)
**Decision:** The AI correction system prompt is considered production-ready at 28/30 on the test suite.
**Reason:** The 2 remaining failures are stochastic (model sometimes omits a stylistic detail) rather than factual errors. The prompt covers: is_partially_correct rules, alternative valid constructions (e.g. שׁל vs. סמיכות), irregular verb class naming, and binyan identification.
**Prompt location:** `lib/prompts/correction.ts`
**Test suite:** `~/hebrew-tester/test.mjs`
**Date:** 2026-03-23
