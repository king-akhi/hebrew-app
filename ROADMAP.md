# Hebrew App — Roadmap

## ✅ Fait
- FSRS-5 spaced repetition (Again / Hard / Good / Easy)
- Génération de cartes via Claude Haiku (prompt caching)
- Correction d'exercices via Claude Sonnet
- Exercices d'écriture dynamiques (générés depuis le deck du user)
- Intervalles SRS personnalisables (Settings page)
- Fix qualité des mots (mot le plus courant en hébreu israélien moderne)
- Fix "Again" → même session (5 min au lieu de demain)
- Flashcards bidirectionnelles (HE→EN + EN→HE, FSRS indépendant par direction)
- Listen (TTS) sur cartes et exercices
- Tags custom + éditeur inline
- Édition inline (translitération, traduction, phrase exemple, notes user)
- Page Vocabulary (liste, recherche, filtres, suppression)
- Preview flashcard complète après ajout + suppression immédiate
- Gamification : streak, mots maîtrisés, taux d'apprentissage, heatmap 12 semaines
- Nav simplifiée (Logo | Cards | Settings | Sign out)

---

## 🗂 Backlog

### 🎉 Congratulations animations & sounds
Célébrer les jalons d'apprentissage.
- Animation confetti au 1er mot maîtrisé, au streak de 7 jours, etc.
- Son optionnel (ding, fanfare courte)
- Toast de félicitations avec le jalon atteint
- **Effort : S**

### 🔍 Tap-to-translate (mots hébreux cliquables)
Tout mot hébreu dans l'app est cliquable — flashcards, phrases exemples, exercises, chat.
- Au clic : popup avec traduction, translittération, notes grammaticales
- Bouton "Add to deck" directement depuis le popup
- Gestion du cas où la carte existe déjà dans le deck
- Composant `<HebrewWord>` réutilisable partout dans l'app
- **Effort : M**

### 🔊 Listen (TTS)
Bouton "Listen" sur chaque flashcard pour entendre le mot et la phrase exemple.
- Web Speech API (gratuit, voix hébraïque sur macOS/iOS)
- Sur la carte : mot + translittération + phrase exemple
- Upgrade possible vers ElevenLabs/Google TTS si qualité insuffisante
- **Effort : S**

### 🏷 Tags custom
- Masquer le tag de niveau (A1/A2…) de l'affichage des cartes (redondant)
- Permettre d'éditer le tag "famille" (catégorie thématique)
- Ajouter des tags personnalisés par l'utilisateur (ex: "voyage", "cuisine", "boulot")
- Filtre par tag sur la page vocabulaire
- **Effort : M**

### 💬 Chat Claude
Assistant contextuel intégré à l'app.
- Chat global (bouton flottant sur toutes les pages)
- Chat contextuel sur une flashcard (Claude sait quel mot est affiché)
- Peut expliquer la grammaire, conjuguer, donner des exemples, corriger
- Streaming API + panneau latéral ou modal
- **Effort : M**

### 🌍 Langue d'interface
Choix de la langue de l'app (Anglais / Français / Espagnol / Italien…).
- Les traductions des cartes et exercices dans la langue choisie (pas seulement EN)
- Prompt card-generation adapté à la langue cible
- Réglage dans Settings
- Note : ne modifie pas l'hébreu, uniquement la langue de traduction
- **Effort : M**

### 🔄 Flashcards bidirectionnelles
Mode HE → EN et EN → HE au choix.
- Option par carte ou globale dans Settings
- **Effort : S**

### 📚 Page vocabulaire
Liste de toutes les cartes du user.
- Filtres : type de mot (nom, verbe…), tag thématique, niveau
- Recherche texte
- Aperçu rapide (hebrew + english + tags)
- **Effort : M**

### ➕ Ajout en masse par thème
"Ajouter du vocabulaire sur la cuisine" → génère 10/20/50 cartes d'un coup.
- Sélection du thème + nombre de cartes
- Génération batch via Claude
- **Effort : M**

### 🔢 Limite quotidienne
Enforcement réel du daily_card_limit (déjà en base, pas encore appliqué dans l'UI).
- Compteur sur le dashboard
- Blocage ou avertissement quand la limite est atteinte
- **Effort : S**

### 🎤 Saisie vocale (Practice)
Dicter sa réponse au lieu de la taper sur la page Practice.
- Web Speech API (reconnaissance vocale)
- **Effort : S**

### 🗣 Mode dialogue AI
Conversation libre en hébreu avec Claude.
- Claude joue un rôle (serveur, médecin, ami…)
- Correction en temps réel
- **Effort : L**

### 📊 Tableaux de conjugaison
Affichage des conjugaisons complètes pour les verbes (par binyan).
- Intégré dans la flashcard ou page dédiée
- **Effort : M**

### 📈 Statistiques & progression
Dashboard de suivi d'apprentissage.
- Streak (jours consécutifs de révision)
- Nombre de cartes apprises / en cours / à revoir
- Taux de rétention global
- Graphique d'activité (type GitHub contributions)
- **Effort : M**

### 🔔 Rappels quotidiens
Notification pour inciter le user à réviser.
- Email ou push notification (PWA)
- Heure personnalisable dans Settings
- **Effort : M**

### 📱 PWA / mode hors-ligne
Utiliser l'app sans connexion internet.
- Service worker + cache des cartes
- Sync au retour en ligne
- **Effort : L**

### 🎯 Onboarding
Parcours de bienvenue pour les nouveaux utilisateurs.
- Choix du niveau, de la langue d'interface, du thème de départ
- Première série de cartes pré-générées selon le niveau
- **Effort : M**

### 🃏 Decks système (curatés)
Decks pré-construits disponibles pour tous les users.
- Ex : "Vocabulaire essentiel A1", "Expressions du quotidien", "Cuisine"
- Le user peut les ajouter à son deck personnel
- **Effort : M**

### 👤 Profil & partage
- Page profil publique avec stats (optionnel)
- Partager une carte ou un deck avec un lien
- **Effort : L**

### 📰 Newsletter hébreu personnalisée
Résumé quotidien de l'actualité israélienne/Moyen-Orient en hébreu, adapté au niveau du user.
- Le user configure ses centres d'intérêt dans Settings (ex: food Tel Aviv, immobilier Israël, tech, politique, culture)
- Claude génère chaque jour un court texte en hébreu (150-300 mots) calibré sur le niveau A1/A2/B1/B2
- Tap-to-translate sur chaque mot → ajout direct en flashcard (mécanisme déjà en place)
- Sources : Claude synthétise depuis ses connaissances + optionnellement une news API (NewsAPI, GNews) pour les titres récents
- Livraison : page dédiée dans l'app (onglet "Read") + optionnellement email
- Chaque newsletter archivée → bibliothèque de textes lus
- **Effort : M**

### 🎵 Apprentissage par cœur (textes & chansons)
Mécanisme pédagogique pour mémoriser un texte hébreu mot par mot avec correction — appliqué d'abord aux textes du curriculum, puis aux chansons.
- **Phase 1 — Mécanisme pédagogique (sans licence)** :
  - Textes intégrés : dialogues générés par Claude, poèmes du domaine public, textes bibliques (Tanakh, Psaumes, blessings), prières courantes
  - Interface : affichage ligne par ligne → le user récite/tape → correction mot par mot → FSRS sur chaque segment
  - Mode "karaoké" : texte révélé progressivement, le user complète les trous
  - Mode "blind" : le user récite de mémoire, Claude corrige
- **Phase 2 — Chansons (avec API licenciée)** :
  - Intégration Musixmatch API ou Genius API ($50-200/mois selon volume) — paroles affichées via API, jamais stockées
  - Le user entre "Omer Adam - שמח" ou "Eyal Golan" → fetch des paroles → même mécanisme pédagogique
  - Tap-to-translate sur chaque mot de la chanson
  - Attribution + lien vers la source (obligatoire contractuellement)
- **Effort Phase 1 : M — Effort Phase 2 : M** (Phase 1 est le prérequis)

---

### 🏛 Architecture cible — 4 pilliers d'apprentissage

La structure long-terme de l'app s'articule autour de 4 modes distincts :

**1. LEARN — Vocabulaire + Grammaire**
- Flashcards bidirectionnelles (déjà fait)
- Conjugaison : grilles de verbes à remplir (par binyan, par temps) — pas des flashcards, un format interactif dédié. L'utilisateur complète le tableau de conjugaison d'un verbe donné (pa'al, pi'el, hif'il…)
- Accords masculin/féminin : exercices d'accord (adjectifs, déterminants) en tapant ou en parlant
- Effort : M pour la conjugaison, M pour les accords

**2. PRACTICE — Phrases écrites**
- Exercices de phrases avec le vocabulaire connu (déjà fait)
- À terme : dictées, reformulations, traductions de phrases plus complexes

**3. TALK — Conversation orale avec Claude**
- Conversation libre ou guidée (roleplay : restaurant, taxi, hôtel…)
- Claude corrige en temps réel
- Saisie vocale → réponse vocale
- Effort : L

**4. Stats & gamification transverses**
- Le streak, les mots maîtrisés et le taux d'apprentissage doivent intégrer LEARN + PRACTICE + TALK
- La to-do list quotidienne reflète les 3 modes actifs

---

### 🎖 Techniques militaires d'apprentissage des langues
Inspirées de la Defense Language Institute (DLI) et des méthodes SERE/BISA utilisées par les armées US/UK/IDF.

**Principes clés à intégrer :**

1. **Vocabulaire à haute fréquence en priorité** — les 2000 mots les plus courants couvrent 95% de la langue parlée. Orienter la génération de cartes vers ces mots en premier (surtout pour A1/A2). Deck système "Top 500 mots hébreu" pré-construit.

2. **Apprentissage par situations** — pas "comment dit-on 'pomme'" mais "comment commande-t-on au restaurant", "comment demande-t-on son chemin", "comment se présente-t-on". Le mode conversation de Claude peut simuler ces situations précises.

3. **Immersion totale par slots de temps courts** — DLI recommande 6-8h/jour mais aussi des sessions de 20 min de haute intensité. Notre mode Practice peut inclure un "sprint mode" : 10 minutes, max d'exercices, pas de pause.

4. **Shadowing** — répéter à voix haute immédiatement après avoir entendu. Le bouton Listen + saisie vocale (future) peuvent créer ce loop : écoute → répète → valide.

5. **Stress inoculation** — apprendre à récupérer ses mots sous légère pression temporelle. Un "mode chrono" optionnel sur les flashcards (timer visible, pas punitif).

6. **Mission-based learning** — thèmes assignés par "mission" plutôt que par catégorie abstraite. Ex : "Mission : réserver un hôtel à Tel Aviv" → génère le vocabulaire exact pour cette situation + exercice de conversation guidé.

7. **After-action review** — après chaque session, recap de ce qui a été raté + pourquoi. Claude peut analyser les patterns d'erreur et donner un feedback personnalisé.

- **Effort global : M-L** (certains éléments rapides comme le sprint mode, d'autres plus longs comme le mission-based learning)

---

## Légende effort
- **S** = quelques heures
- **M** = 1-2 jours
- **L** = 3+ jours
