# Phase: Daily card limit enforcement

## Goal
Enforce the `daily_card_limit` stored on the `users` row. Currently stored in DB but ignored entirely.

## Success criteria
- [ ] Review queue (`/api/cards/due`) respects `daily_card_limit` — never returns more cards than the limit
- [ ] Dashboard shows "X / N cards reviewed today" when limit is active
- [ ] When limit is reached, Learn CTA shows "Limit reached" instead of card count
- [ ] Settings slider for daily_card_limit already works (no change needed)

## Implementation plan
1. **`/api/cards/due/route.ts`** — fetch user's `daily_card_limit`, count today's reviews, pass `limit = max(0, daily_card_limit - todayReviews)` to the due query
2. **`/api/stats/route.ts`** — already returns `today_reviews`, add `daily_card_limit` to the response
3. **`app/app/page.tsx`** — update dashboard Learn CTA: if `todayReviews >= dailyLimit`, show "Limit reached for today"
4. **`components/StatsPanel.tsx`** — show progress toward limit in daily goals

## Files to touch
- `app/api/cards/due/route.ts`
- `app/api/stats/route.ts`
- `app/app/page.tsx`
- `components/StatsPanel.tsx`

## Risks
- `daily_card_limit` column might not exist on older user rows → default to 20
- Today's review count must use same timezone logic as streak (UTC)
