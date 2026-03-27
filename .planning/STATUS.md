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

### En attente de push prod (sur branche `dev`)
- Vocabulary + BatchAddModal phonétique
- Voice fix
- Practice tenses fix

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

### V2 — Backlog lointain

| Feature | Effort | Notes |
|---------|--------|-------|
| **Onboarding** | M | Retiré de V1 pour finir l'UI d'abord. Concept repensé : (1) Demander le niveau (A1/A2/B1/B2) — envisager aussi "niveau zéro : connaît-il les lettres ?" pour gérer ce cas limite. (2) Expliquer la logique de l'app façon "guided tour" en montrant l'interface : LEARN = apprendre/réviser vocabulaire + conjugaison ; PRACTICE = s'entraîner à parler en hébreu, basé sur les cartes que le user a créées — donc les deux piliers sont liés, parler avec ce qu'on connaît. (3) Inviter le user à créer sa première carte (pas d'import aveugle). (4) Proposer ensuite d'ajouter **20 mots** selon son niveau (pas 150) et afficher la liste des 20 mots pour qu'il voie ce qu'il va apprendre. Note : ne pas proposer l'import avant que le user comprenne la logique — c'est le problème de la V1. Migration `migration_007_onboarding.sql` ✅ appliquée en DB. |
| **System decks v2 — 18 catégories thématiques** | L | Remplace les decks A1/A2/B1 génériques par des decks thématiques granulaires : (1) Bases essentielles — alphabet, salutations, mots de base ; (2) Temps & dates — jours, mois, saisons, l'heure, expressions ; (3) Nombres & quantités ; (4) Personnes & identité — pronoms, famille, professions, nationalités ; (5) Maison & quotidien ; (6) Nourriture & cuisine — fruits, légumes, viande, boissons, plats ; (7) Vêtements & apparence — couleurs, description physique ; (8) Corps & santé — parties du corps, médecine ; (9) Lieux & déplacements — ville, transports, voyage ; (10) Shopping & argent ; (11) Travail & business ; (12) Technologie & communication ; (13) Verbes essentiels — quotidien, mouvement, irréguliers ; (14) Expressions & phrases utiles ; (15) Émotions & opinions ; (16) Nature & environnement — animaux, météo ; (17) Loisirs & vie sociale ; (18) Connecteurs & grammaire — prépositions, conjonctions, adverbes. Nécessite nouveau seed script + UI de browsing par catégorie. |
| **Chat AI full** | M | 50 msg/jour, Sonnet + contexte riche |
| **Talk mode** | L | Conversation libre en hébreu, 3 sessions/sem × 10 éch. |
| **Sprint mode** | S | Session 10 min haute intensité |
| **PWA / offline** | L | Service worker, sync |
| **Interface language** | M | FR/ES/IT — langue de traduction des cartes |
| **Error monitoring** | S | Sentry (client + serveur) + error boundaries React + alerting Vercel 5xx. Pas nécessaire en v1 (beta fermée amis). |
| **Monétisation / Premium** | M | Définir le modèle (abonnement, one-time, app store ?) + gating features (is_premium en DB). Étudier App Store vs web-only vs les deux. Pas de Stripe tant que le canal de distribution n'est pas clair. |
| **Premium TTS — Voix hébraïques naturelles** | S | Remplace la Web Speech API actuelle (accent synthétique) par une vraie voix hébraïque. Feature Premium uniquement. Choix entre 2-3 voix (ex. voix masculine + féminine + "radio"). Candidats retenus : (1) **ElevenLabs** (Multilingual v2) — meilleure qualité absolue, des dizaines de voix hébraïques, ~$180-300/1M chars ; (2) **Google WaveNet** — bon rapport qualité/prix, 4 voix he-IL, $16/1M chars, 1M gratuit/mois ; (3) **Azure Neural** — 2 voix (Hila féminine + Avri masculin), $16/1M chars. OpenAI TTS à exclure : accent américain fort en hébreu, signalé par de nombreux users. Architecture recommandée : **caching agressif** — pré-générer l'audio de chaque carte une fois, stocker dans Supabase Storage/CDN → coût marginal après setup initial. Seules les phrases de Practice (saisies librement) nécessitent du TTS temps réel. |
| **Smart Card Capture** | M | Enrichir le flow "Add new cards" avec des sources d'entrée libres au-delà du texte manuel. Le user peut soumettre : (1) **Photo** (menu de restaurant, panneau, affiche, livre) → OCR hébreu + extraction des mots inconnus → génération de cartes ; (2) **Voice note** → transcription audio → extraction des mots ; (3) **Texte libre** collé (article, SMS, email) → extraction automatique des mots nouveaux. Dans tous les cas : Claude identifie les mots hébreux, les compare au deck existant (dédup), propose une sélection que le user valide avant ajout. Nécessite : API Vision (Claude) pour les images, API Whisper ou équivalent pour l'audio, UI de validation des mots extraits. |
| **Resources** | M | Onglet dédié "Resources" — base de connaissances grammaticales pour les users qui veulent comprendre ce qu'ils apprennent, pas seulement mémoriser. Contenu statique organisé par thèmes : (1) L'alphabet et la prononciation ; (2) Les racines (שורש) et la logique des mots ; (3) Le présent — binyanim, accords genre/nombre ; (4) Le passé — conjugaisons par binyan, verbes irréguliers (creux, ל״ה, etc.) ; (5) Le futur ; (6) L'impératif ; (7) Les accords nom-adjectif (genre, nombre, défini) ; (8) L'article défini ה et ses règles ; (9) Les pronoms (personnels, possessifs, démonstratifs) ; (10) La construction סמיכות (état construit) ; (11) Les prépositions et leurs déclinaisons (ב, ל, מ, עם…) ; (12) Les mots invariables (adverbes, conjonctions, connecteurs) ; (13) Les nombres et leur accord de genre. Format : pages claires avec exemples interactifs — mots hébreux cliquables → ajout en flashcard. Contenu rédigé une fois, maintenu statiquement (pas de génération IA à chaque vue). |
| **Song Learning** | L | Section SONGS dédiée. Le user choisit une chanson hébraïque qu'il veut apprendre par cœur. Deux cas : (1) **Chansons libres de droits** (folk israélien, chansons traditionnelles) — paroles stockées directement, pas de contrainte. (2) **Chansons sous droits** (ex. "Rak Shelakh" d'Omer Adam) — nécessite une API de paroles licenciée (Musixmatch ou Genius) → feature **Premium uniquement**. UI : affichage du texte complet hébreu avec traduction ligne par ligne, chaque mot cliquable → ajout en flashcard. Mémorisation progressive possible (masquer des mots, karaoké-mode, etc.). Nécessite : choix de l'API paroles + gestion des licences, UI song browser/search, intégration tap-to-translate sur les paroles, éventuelle section "mes chansons sauvegardées". |
| **Newsflash** | M | Le user sélectionne ses centres d'intérêt (food, politique, économie, sport, culture, tech…). Chaque jour, il reçoit 5-10 bullet points d'actualité rédigés en hébreu, calibrés sur son niveau. Chaque mot hébreu est cliquable → modal de preview → ajout en flashcard. Nécessite : (1) stockage des préférences user, (2) job quotidien de génération (Claude Haiku + source d'actualités — RSS ou API news), (3) UI "daily feed" dans le dashboard ou section dédiée, (4) déduplication avec les cartes existantes du user. Potentiellement très engageant pour la rétention (contenu frais chaque jour). |
| **Landing page** | M | Page publique avant le signup. Nécessaire pour toute acquisition. Doit inclure le Meta Pixel dès le début pour accumuler des données avant les campagnes. |
| **Repo privé + Vercel Pro** | S | Repo GitHub actuellement public (workaround beta). Avant lancement public : repasser le repo en privé sur GitHub + passer Vercel en Pro ($20/mois) pour débloquer les déploiements depuis repos privés. |
| **Rate limiting** | S | Limiter les appels aux endpoints IA (génération de cartes, correction, conjugaison) par user/IP pour éviter les abus coûteux. Pas urgent en beta fermée, indispensable avant ouverture publique. |
| **Distribution** | — | Canal envisagé : comptes spécialisés Instagram/TikTok (organique), Meta Ads. Définir la cible (francophone ? anglophone ? les deux ?), le positionnement (DLI-inspired, serious learner), et le funnel landing page → signup → first session. **Meta Pixel** à installer avant toute campagne : tracking signup + landing page visits → Custom Audiences (email match), Lookalike Audiences, optimisation automatique des pubs. Sans pixel = Meta tire dans le vide, coût pub 2-3× plus élevé. 10 lignes de code dans le `<head>` + event `CompleteRegistration` post-signup. |

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
