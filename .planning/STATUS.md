# Project Status — Hebrew Learning App

> **Mise à jour :** 2026-03-27
> **Règle :** Ce fichier doit être mis à jour à chaque session de travail.

---

## État général

**V1 feature-complete.** Prête pour checklist de lancement. V2 backlog complet (voir ci-dessous).

---

## Ce qui est livré (complet)

### Core (session initiale)
- [x] FSRS-5 spaced repetition (Again / Hard / Good / Easy), bidirectionnel HE→EN + EN→HE
- [x] Génération de cartes via Haiku (prompt caching, lemmatisation, déduplication)
- [x] Review session (révélation, rating, édition inline, suppression)
- [x] Writing practice + correction Sonnet
- [x] Vocabulaire page (search, filtres, édition inline, suppression)
- [x] Tap-to-translate (HebrewWord + ClickableHebrew + modal)
- [x] Gamification : streak, mots maîtrisés, taux d'apprentissage, heatmap 12 semaines
- [x] Son (Web Audio API) + confetti (canvas-confetti)
- [x] Settings : SRS intervals, display name, niveau, daily limit, son
- [x] Auth Supabase multi-user, RLS

### Session 2026-03-26
- [x] **Bulk add by theme** — POST /api/cards/batch
  - Prend { theme, count, level }
  - Étape 1 : Claude génère une liste de N mots (en excluant les mots déjà dans le deck)
  - Étape 2 : génération parallèle de chaque carte (dedup, retry si manquant)
  - UI : BatchAddModal (thème + sélecteur count 5/10/20/30, liste résultat cliquable avec preview)
  - Retry automatique si des mots slippent à travers la dedup
- [x] **Daily card limit enforcement**
  - Compté via fsrs_state (direction he_to_en uniquement pour éviter le double-count)
  - Appliqué dans POST /api/cards ET POST /api/cards/batch
  - Bannière inline "Daily limit reached" avec boutons +5/+10/+20 pour augmenter direct
  - Appliqué aussi dans HebrewWord modal (tap-to-translate)
  - dir="ltr" sur la bannière pour éviter le RTL bleed du contexte hébreu
- [x] **Espacement HE→EN / EN→HE** — algorithme round-robin dans /api/cards/due
  - Les deux directions d'une même carte sont maintenant maximalement espacées dans la queue
- [x] **End session button** — renommé "Stop" → "End session", restyled en bouton bordé
- [x] **Suppression de carte en review** — bugfix : filtre par card_id (supprime les 2 directions) au lieu de filter par index array
- [x] **Suppression Claude** dans l'UI — aucune mention "Claude" visible par l'user
- [x] **Prompt card generation** — améliorations :
  - מסעדה vs רסטורן (restaurant) — préférer le mot natif
  - תפוז vs תפוח זהב (orange) — ne jamais remonter à l'étymologie si un mot court existe
  - Règle multi-mots clarifiée : seulement si aucun mot simple n'existe
  - Consistency check : le mot du champ "hebrew" DOIT apparaître dans example_sentence_he
- [x] **Refacto shared helpers** — lib/cards/generate.ts (generateCardContent, saveCard, getOrCreateDeck, countCardsCreatedToday)
- [x] **Chat AI placeholder** — bloc "AI Tutor" sur le dashboard, badge Premium + Soon

---

## Session 2026-03-27 (suite 2) — Lancement + UI

### Déploiement
- [x] **Vercel déployé** — URL prod : `hebrew-app-beryl.vercel.app`. Repo GitHub public (workaround Vercel Hobby). À repasser privé en V2 (voir backlog).
- [x] **Branche `dev`** — workflow : commits sur `dev`, merge dans `main` pour déployer. Jamais de push direct sur `main`.
- [x] **Migration 008 appliquée** — `example_sentence_transliteration` ajouté sur `cards` + `system_cards`.
- [x] **Signup** — email confirmation désactivée dans Supabase, redirect direct vers `/app` après signup.

### Fixes
- [x] **middleware.ts supprimé** — doublon de `proxy.ts` (Next.js 16 renomme middleware → proxy). Causait une erreur de build.
- [x] **Signup password** — minLength harmonisé à 8 chars (était 6 au signup, 8 au changement de mot de passe).
- [x] **System decks import 429** — erreur "daily limit reached" affichée dans le modal + bouton désactivé (était silencieux avant).
- [x] **Voice transcription** — `.join("")` → `.join(" ")` + trim : les mots ne se collent plus sur iPhone.
- [x] **Practice tenses** — l'API `practice/exercises` lit maintenant `known_tenses` du user et le passe à Claude comme contrainte. Plus d'exercices au passé/futur si non débloqués.

### UI
- [x] **Review card** — GrammarBox (genre/pluriel) déplacé juste après la traduction, avant la phrase. Label "Example" ajouté. Compactage général (padding réduit, text-4xl au lieu de 5xl) pour éviter le scroll sur iPhone.
- [x] **Phonétique phrase exemple** — champ `example_sentence_transliteration` généré par Claude (nouvelles cartes), affiché sous la phrase hébraïque dans : review page, AddWordForm, BatchAddModal, vocabulary page.
- [x] **Vocabulary page** — même format que review : GrammarBox en premier, label "Example", phonétique.

### Session 2026-03-28 — Fixes & Performance

#### Fixes
- [x] **Tap-to-translate ambiguïté** — HebrewWord passe maintenant la phrase complète comme contexte à l'API. Claude sait dans quel sens interpréter le mot (ex: החרק = insecte, pas le verbe grincer).
- [x] **Favicon** — `app/icon.svg` : lettre א sur fond sombre #18181b, coins arrondis.
- [x] **OG image WhatsApp** — `app/opengraph-image.tsx` (Next.js ImageResponse) : fond sombre, grand א, "Aleph", "Learn Modern Hebrew". Résout le logo par défaut sur les previews de liens.
- [x] **Conjugation table — un seul déclencheur** — supprimé le bouton "View conjugation table" en dessous de la carte review. Le lien "→ Full conjugation table" dans GrammarBox ouvre désormais le ConjugationModal (overlay) au lieu de naviguer vers une nouvelle page. GrammarBox accepte un prop `onConjugationClick`. Appliqué aussi dans Vocabulary page.

#### Performance
- [x] **Practice — pre-fetch exercises** — le fetch Claude part dès que l'écran de config s'affiche (pas au clic "Start"). Si l'user garde les réglages par défaut, "Start" est quasi-instantané. Basé sur un `prefetchRef` + key `count:type:cardId`.
- [x] **HebrewWord modal — mot immédiat** — le mot hébreu cliqué s'affiche immédiatement avec skeleton animé pendant la génération. Fini le spinner blanc vide de 2-3s.
- [x] **Conjugation — pre-warm** — après création d'un verbe (AddWordForm + tap-to-translate modal), fire-and-forget vers `/api/conjugation?cardId=xxx` pour pré-générer la table. Quand l'user l'ouvre, c'est déjà prêt.

---

## Session 2026-03-27 (suite) — Audit lancement

### Livré
- [x] **middleware.ts** — créé (manquait complètement). Corrige : refresh de session JWT, redirect `/app` → `/login` si non-connecté, redirect `/login` → `/app` si connecté. Sans ça, crash serveur après ~1h (null assertion `user!.id`).
- [x] **system-decks/import** — daily limit enforced. Avant : import de 150 cartes bypass complet. Maintenant : capped au `remaining` + 429 si limit atteinte.
- [x] **Profile page** — `router.refresh()` après sauvegarde du nom → le header met à jour sans reload manuel.
- [x] **Dead code supprimé** — `app/api/cards/generate/route.ts` (ancien endpoint jamais appelé côté front).

### Décisions techniques
- Architecture auth : middleware Supabase SSR pattern officiel (getAll/setAll cookies sur request + response)
- No breaking changes — tous les fixes sont rétrocompatibles

---

## Session 2026-03-27
- [x] **Session 2026-03-27** — Onboarding supprimé V1 → backlog V2 (notes UX détaillées). Nom app : **Aleph** (logo א + Space Grotesk, letter-spacing -0.03em). Header : Cards supprimé, Feedback texte, nom user → /app/profile. Page Profile créée (display name + password). Settings : Hebrew level + display name supprimés. Dashboard : 4 boutons → 2 (All cards + Add new cards avec menu 3 options). STATS section ajoutée. Heatmap + goals côte à côte. Practice : guillemets/point supprimés, hint supprimé, double explication supprimée, prompt `is_partially_correct` durci, correcteur ancré sur le mot de la carte (`expected_hebrew`). Conjugaison : accepte pronoun+verb (היא עושה) ou verb seul (עושה). Labels Practice : Translate→Sentences, Talk→Conversation.
- [x] **Onboarding supprimé de la V1** — `app/onboarding/page.tsx` + `app/api/onboarding/complete/route.ts` supprimés. Redirect `onboarding_completed` retiré du layout. Déplacé en backlog V2 (voir ci-dessous).

---

## Backlog V1 — Ce qui reste à livrer

| # | Feature | Effort | État | Notes |
|---|---------|--------|------|-------|
| 1 | **System decks** | M | ✅ Livré | Code + seed + lien "Explore decks" dans le dashboard. |
| 2 | **Feedback** | S | ✅ Livré | FeedbackModal (icône header), POST /api/feedback, table feedback (migration_006). |
| 3 | **Chat AI FAB** | S | ✅ Livré | ChatFAB fixed bas-droite, grisé, tooltip "AI Tutor — coming soon". |
| 4 | **Talk mode (grisé)** | S | ✅ Déjà fait | Carte PRACTICE déjà grisée + "Soon" dans le dashboard. |

### V2 — Backlog priorisé (session stratégique 2026-03-27)

> **Vision validée :** L'hébreu est le proof of concept. Aleph = plateforme d'apprentissage des langues difficiles pour les gens sérieux. Ambition : au-delà de l'hébreu dans les versions futures.

#### PRIORITÉ 1 — Onboarding + 18 decks thématiques (BLOQUANT pour la croissance)
Les 18 decks thématiques font PARTIE de l'onboarding — pas une feature secondaire.

**Onboarding en 3 étapes :**
1. Expliquer la raison d'être (FSRS, vraie progression, anti-Duolingo)
2. Expliquer le fonctionnement : flashcards → schedule → practice lié aux cartes qu'on connaît
3. Choisir 1-2 decks parmi les 18 thèmes → premier set de cartes → première session → "aha moment" en < 3 min

**Les 18 decks thématiques :** (1) Bases essentielles — alphabet, salutations, mots de base ; (2) Temps & dates ; (3) Nombres & quantités ; (4) Personnes & identité — pronoms, famille, professions ; (5) Maison & quotidien ; (6) Nourriture & cuisine ; (7) Vêtements & apparence ; (8) Corps & santé ; (9) Lieux & déplacements — ville, transports, voyage ; (10) Shopping & argent ; (11) Travail & business ; (12) Technologie & communication ; (13) Verbes essentiels — quotidien, mouvement, irréguliers ; (14) Expressions & phrases utiles ; (15) Émotions & opinions ; (16) Nature & environnement — animaux, météo ; (17) Loisirs & vie sociale ; (18) Connecteurs & grammaire. Migration `migration_007_onboarding.sql` ✅ appliquée en DB.

#### PRIORITÉ 2 — Progression narrative
Transformer les stats sèches en jalons de vie réelle :
- "Tu connais 47 mots → ~15% d'une conversation quotidienne"
- "À 200 mots, tu pourras commander dans un restaurant"
- "À 500 mots, tu comprends la plupart des conversations basiques"
Intégrée dans le dashboard. Motivation intrinsèque sans gamification creuse.

#### PRIORITÉ 3 — Smart Capture (photo + texte → cartes)
Feature virale = growth mechanic principal. Photo d'un menu / texte copié d'un article → cartes générées en 10 secondes. Bridge entre l'app et la vie réelle. C'est CE DONT LES GENS PARLENT à leurs amis.
Nécessite : API Vision Claude pour les images, UI de validation des mots extraits, dédup avec deck existant.

#### PRIORITÉ 4 — Newsflash
5 phrases d'actualité/jour en hébreu, calibrées sur le niveau, chaque mot cliquable → carte. Installe l'habit quotidien indépendamment du schedule FSRS. Job quotidien Claude Haiku + source RSS/API news.

#### PRIORITÉ 5 — Chat AI Tutor (full)
Tuteur qui connaît TON deck, tes lacunes, tes mots récents. Pas un chatbot générique — construit la conversation à partir de ce que le user sait déjà. Ancre émotionnelle + justification abonnement Premium. 50 msg/jour, Sonnet + contexte riche (profil, deck, 20 dernières cartes, page courante).

#### PRIORITÉ 6 — Songs
Attachement émotionnel à la langue. Chansons libres de droits incluses, chansons sous droits = Premium (Musixmatch/Genius API). Paroles hébreu avec traduction ligne par ligne, tap-to-translate. Ultra-partageable = canal content TikTok/Instagram.

#### PRIORITÉ 7 — Communauté (moat de defensibilité)
- Ajouter des amis + voir leur progression
- Partager des decks entre amis
- Cohort-based learning (groupe qui apprend ensemble)
- Leaderboard de cartes révisées entre amis (gamification sociale légère)
Switching cost émotionnel + social. Réseau d'effets.

---

### Distribution — 4 canaux validés

1. **Content TikTok/Instagram** — coût quasi zéro, reach énorme. Angle : "Duolingo ne t'apprend pas vraiment à parler." + demos Smart Capture, Songs. Meilleur canal pour acquisition organique.
2. **Communautés existantes** — Hillel, synagogues, Birthright alumni, Taglit, ulpans, organisations pro-Israel
3. **B2B** — écoles juives, ulpans, organisations communautaires
4. **SEO** — "how to learn Hebrew" — volume faible mais intent fort (serious learners)
Meta Pixel à installer avant toute campagne paid : tracking signup + landing page → Custom Audiences.

### Defensibilité — Les vrais moats

1. **Données utilisateur** — deck personnel, historique, lacunes identifiées. Switching cost réel.
2. **Modèle de correction fine-tuné** — logger toutes les paires (réponse user → correction idéale). C'est LE moat technique à construire dès maintenant (infra de logging). Plus d'users = meilleur modèle = flywheel.
3. **Communauté** — decks partagés, amis, cohorts.
4. **Contenu authentique** — Smart Capture, Songs, Newsflash ancrent l'app dans la vie réelle.

### Expansion multilingual
Hébreu → Arabe/Persan (sémitiques) → toute langue difficile.
Pitch dans 24 mois : "Aleph est la plateforme d'apprentissage des langues difficiles pour les gens sérieux." Marché : ~50M personnes.

---

### Reste du backlog (non priorisé)

| Feature | Effort | Notes |
|---------|--------|-------|
| **Talk mode** | L | Conversation libre en hébreu |
| **Sprint mode** | S | Session 10 min haute intensité |
| **PWA / offline** | L | Service worker, sync |
| **Interface language** | M | FR/ES/IT — langue de traduction des cartes |
| **Error monitoring** | S | Sentry + error boundaries React. Pas urgent en beta fermée. |
| **Monétisation / Premium** | M | Stripe + is_premium en DB. Pas avant que la distribution soit claire. |
| **Premium TTS** | S | ElevenLabs ou Google WaveNet (he-IL). Caching agressif dans Supabase Storage. |
| **Resources** | M | Base de connaissances grammaticales statique, mots cliquables → cartes. |
| **Landing page** | M | Nécessaire avant toute acquisition publique. Meta Pixel dès le départ. |
| **Repo privé + Vercel Pro** | S | Avant lancement public. |
| **Rate limiting** | S | Indispensable avant ouverture publique. |

---

## Session 2026-03-26 (suite) — Conjugaison + UI Redesign

### Livré
- [x] **Dashboard redesign** — LEARN (bleu: Words + Verbs) + PRACTICE (vert: Translate + Talk)
- [x] **Pages Verbs** — `/app/verbs` (liste + pills de temps) + `/app/verbs/[cardId]` (table de conjugaison)
- [x] **API conjugation** — `GET /api/conjugation?cardId=xxx` (fetch/génère + cache via Haiku)
- [x] **API conjugation exercises** — `GET /api/conjugation/exercises?count=N&cardId=xxx&tenses=...`
- [x] **API conjugation log** — `POST /api/conjugation/log` (streak/heatmap)
- [x] **ConjugationTable** composant (display, tenses lockées si non débloquées)
- [x] **ConjugationModal** — overlay pendant session Words (verb cards)
- [x] **Practice page** — setup screen (count 5/10/20/custom + type random/conjugation/grammar/vocab), mode conjugation, progress bar verte
- [x] **Review page** — bouton "View conjugation table" sur les verbes
- [x] **Stats** — conjugation_logs comptés dans streak/heatmap
- [x] **Settings API** — `known_tenses` ajouté
- [x] **Gestion des temps** (statique) — pills dans Verbs page, confirmation unlock, PATCH settings

### Fixes & polish (même session)
- [x] **ConjugationTable présent** — format harmonisé avec passé/futur (I/You m./You f./He/She/We/… au lieu de Masc. singular)
- [x] **Verbs list** — traduction anglaise nettoyée : "to " supprimé, formes passées retirées ("bring, brought" → "bring"), bouton audio déplacé à côté de l'hébreu
- [x] **Exercices conjugaison** — prompt naturel ("She brings", "You (f.) will write") au lieu du format mécanique, infinitif hébreu masqué
- [x] **Practice page queue** — plus de doublons dans une session ; questions incorrectes retentées (insérées en position 3 de la queue) jusqu'à être réussies ; session se termine quand tout est correct
- [x] **GrammarBox verbes** — lien "→ Full conjugation table" cliquable vers `/app/verbs/[cardId]` (remplace "coming soon")
- [x] **Vocabulary "Add a card"** — ouvre désormais le CreateCardModal au lieu de rediriger vers le dashboard
- [x] **Backlog** — AI Tutor redéfini en FAB bas-droite (pas de bloc dashboard) ; Feedback ajouté (icône header)

### Décisions techniques (même session)
- [x] **Correction → Haiku pour tout le monde** — Sonnet retiré de `/api/correct`. Haiku passe 28/30 tests, avantage Sonnet trop marginal pour justifier le coût 5×. `model_used` logué en DB pour suivi qualité.
- [x] **Prompt caching sur `/api/correct`** — system prompt passé en tableau avec `cache_control: ephemeral`. Économie ~10× sur la portion system prompt à chaque appel.
- [x] **System cards cache + System Decks**
  - Table `system_cards` (globale, partagée, UNIQUE sur `english`)
  - Cache check avant Haiku dans `/api/cards` et `/api/cards/batch` — write-back fire-and-forget
  - `GET /api/system-decks` — liste des decks avec counts
  - `POST /api/system-decks/import` — importe un deck dans le deck perso
  - `/app/system-decks/page.tsx` — UI browsing/import
  - `scripts/seed-system-cards.ts` — script one-time (~$1, 10-15min)
  - ✅ migration_005 appliquée
  - ✅ Script seed terminé — 4 decks disponibles (A1, A2, B1, Verbs)
  - 🔜 Lien vers `/app/system-decks` à ajouter dans le dashboard

---

## Architecture Premium / Light (décision)

### Light (gratuit)
- Daily card limit (configurable dans Settings, défaut 20/jour)
- Toutes les features de base

### Premium (payant — pas encore implémenté)
- Flashcards illimitées (plafond technique ~200/jour pour les coûts)
- Chat AI / AI Tutor (50 msg/jour, ~$0.008/message)
- Futures features IA avancées

---

## Chat AI — Architecture (en standby, Premium)

Décidé mais pas encore implémenté. Voir `.claude/projects/.../memory/project_chat_ai_architecture.md`.

Résumé :
- Bouton flottant → panel latéral, streaming, historique non persisté
- Modèle : Sonnet + prompt caching (~$0.0076/message)
- Contexte : profil, deck, 20 dernières cartes, page courante, 10 derniers échanges
- Scope strict : hébreu + app uniquement
- Feedback structuré en DB (`feedback` table), notif email au dev
- Pas d'auto-fix de bugs depuis le chat
- Limite : 50 msg/jour par défaut

---

## Fichiers clés

```
app/
  api/
    cards/route.ts              — POST: generate + dedup card (limite daily enforced)
    cards/[id]/route.ts         — PATCH/DELETE card
    cards/due/route.ts          — GET: FSRS due queue (interleaving HE/EN)
    cards/all/route.ts          — GET: all user cards
    cards/batch/route.ts        — POST: bulk add by theme
    correct/route.ts            — POST: AI correction (Sonnet)
    reviews/route.ts            — POST: FSRS review submission
    stats/route.ts              — GET: streak, heatmap, goals
    settings/route.ts           — GET/PATCH: user settings
    practice/exercises/route.ts — GET: generate practice exercises
  app/
    page.tsx                    — Dashboard (+ AI Tutor placeholder)
    review/page.tsx             — Review session
    practice/page.tsx           — Writing practice
    vocabulary/page.tsx         — Vocabulary list
    settings/page.tsx           — Settings
    AddWordForm.tsx             — Formulaire ajout carte (+ limit banner)
components/
  BatchAddModal.tsx             — Modal bulk add by theme
  CreateCardModal.tsx           — Modal ajout carte individuelle
  GrammarBox.tsx                — Structured grammar display
  HebrewWord.tsx                — Tap-to-translate (+ limit banner)
  ListenButton.tsx              — TTS button
  TagEditor.tsx                 — Inline tag editor
  EditableField.tsx             — Inline field editor
  StatsPanel.tsx                — Gamification panel
lib/
  cards/generate.ts             — Shared helpers (generateCardContent, saveCard, etc.)
  fsrs.ts                       — FSRS-5 TypeScript implementation
  prompts/
    card-generation.ts          — Prompt Haiku (amélioré: natif > loanword, consistency check)
    correction.ts               — Prompt Sonnet correction
    exercise-generation.ts      — Prompt exercices
```
