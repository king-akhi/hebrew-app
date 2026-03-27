# Hebrew Learning App — PROJECT.md

## What this is
A full-stack Hebrew language learning app built on Next.js 16 + Supabase + Claude AI. Core loop: add vocabulary → spaced repetition review → writing practice → conversation (planned). Designed for serious adult learners, inspired by Defense Language Institute methodology.

## Stack
- **Frontend:** Next.js 16 App Router, Tailwind CSS v4, React
- **Backend:** Supabase (Postgres + Auth + RLS), Next.js API routes
- **AI:** Claude Haiku (card generation + prompt caching), Claude Sonnet (pedagogical correction)
- **SRS:** FSRS-5 (TypeScript port) — stability/difficulty per card per direction
- **Other:** Web Speech API (voice input + TTS), canvas-confetti, Web Audio API

## Architecture decisions
See DECISIONS.md for full rationale. Key ones:
- Multi-tenant from day one (organizations table) — future B2B ready
- FSRS-5 over SM-2 — scientifically superior, accumulated profile is the moat
- Haiku for volume (card gen), Sonnet for quality (correction)
- RLS at DB level — authorization bugs eliminated structurally
- `daily_card_limit` stored on users row, not computed

## Current state: PRODUCTION-READY CORE ✅

### Working features
- **FSRS-5 SRS** — bidirectional cards (HE→EN + EN→HE), independent FSRS state per direction
- **Card generation** — Claude Haiku, prompt caching, lemmatization of inflected Hebrew forms, structured grammar (verb/noun/adjective), deduplication by English + Hebrew
- **Review session** — rate cards (Again/Hard/Good/Easy), inline editing, delete during review, GrammarBox, ListenButton (TTS), ClickableHebrew (tap-to-translate)
- **Writing practice** — AI correction (Sonnet), voice input (Web Speech API), "No idea" button, clickable correction words → add to deck
- **Tap-to-translate** — any Hebrew word clickable → confirmation bubble → flashcard modal (auto-add + delete)
- **Vocabulary page** — search, tag filters, inline edit all fields, delete, GrammarBox, ClickableHebrew on example sentences
- **Settings** — SRS intervals, display name, Hebrew level, sound toggle (localStorage)
- **Gamification** — streak (with 1-day grace), words mastered, learning rate, 12-week heatmap, daily goals (add 5 cards / complete review session / practice)
- **Sound + confetti** — Web Audio API chime on correct answers, canvas-confetti on session complete
- **Auth** — Supabase Auth, multi-user, personal decks per user

### Known gaps / technical debt
- `daily_card_limit` stored in DB but not enforced in the review queue (D005 — intentional for now)
- No error boundaries in React — unhandled exceptions surface as blank pages
- No loading skeletons — just spinners/text
- No tests (correction prompt validated manually at 28/30 — see DECISIONS.md D006)
- `correction_logs` insert now awaited (was fire-and-forget — fixed, caused streak/heatmap to show 0)
- No rate limiting on AI endpoints — one user can spam card generation
- Talk mode (3rd pillar of learning) not yet built

## Remaining backlog (priority order)

| Priority | Feature | Effort | Notes |
|----------|---------|--------|-------|
| 1 | **Chat Claude** | M | Contextual AI assistant, knows current card/page |
| 2 | **Interface language** | M | FR/ES/IT translation of cards + exercises |
| 3 | **Bulk add by theme** | M | "Add 20 kitchen words" via Claude |
| 4 | **Conjugation tables** | M | Full verb tables by binyan |
| 5 | **Daily card limit enforcement** | S | Already in DB, just needs UI + queue filter |
| 6 | **Onboarding** | M | Level picker + starter deck on first login |
| 7 | **System decks** | M | Curated A1/A2 decks, Top 500 words |
| 8 | **Sprint mode** | S | 10-min high-intensity session |
| 9 | **Talk mode** | L | Free Hebrew conversation with Claude (roleplay) |
| 10 | **PWA / offline** | L | Service worker, sync on reconnect |

## Key files
```
app/
  api/
    cards/route.ts          — POST: generate + dedup card
    cards/[id]/route.ts     — PATCH/DELETE card
    cards/due/route.ts      — GET: FSRS due queue
    cards/all/route.ts      — GET: all user cards
    correct/route.ts        — POST: AI correction (Sonnet)
    reviews/route.ts        — POST: FSRS review submission
    stats/route.ts          — GET: streak, heatmap, goals
    settings/route.ts       — GET/PATCH: user settings
    practice/exercises/route.ts — GET: generate practice exercises
  app/
    page.tsx                — Dashboard
    review/page.tsx         — Review session
    practice/page.tsx       — Writing practice
    vocabulary/page.tsx     — Vocabulary list
    settings/page.tsx       — Settings
components/
  GrammarBox.tsx            — Structured grammar display (verb/noun/adjective)
  HebrewWord.tsx            — Tap-to-translate (ClickableHebrew + modal)
  ListenButton.tsx          — TTS button
  TagEditor.tsx             — Inline tag editor
  EditableField.tsx         — Inline field editor
  StatsPanel.tsx            — Gamification panel
hooks/
  useSound.ts               — Web Audio API chime
  useConfetti.ts            — canvas-confetti burst
lib/
  fsrs.ts                   — FSRS-5 TypeScript implementation
  prompts/
    card-generation.ts      — Claude system prompt (Haiku)
    correction.ts           — Claude system prompt (Sonnet)
    exercise-generation.ts  — Practice exercise prompt
```

## Long-term vision: 4 learning pillars
1. **LEARN** — Flashcards + grammar (done) + conjugation tables (backlog)
2. **PRACTICE** — Written exercises (done) + dictation + complex translations (backlog)
3. **TALK** — Free conversation with Claude, roleplay scenarios (backlog)
4. **STATS** — Unified gamification across all 3 modes (partially done)
