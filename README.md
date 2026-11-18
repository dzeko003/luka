# Luka

> *luka* : « chercher », en lingala.

Luka est une plateforme de collecte de données. Tu décris en français ce que tu cherches
(« les arrondissements de Brazzaville avec leur maire », « les villes du Cameroun »…),
Luka propose les colonnes du tableau, cherche sur le web, extrait les données avec une IA
et te les présente **avec la source de chaque ligne**. Tu vérifies, puis tu exportes.

## Fonctionnalités (MVP)

- Comptes : email et mot de passe, Google (facultatif), captcha Cloudflare Turnstile (facultatif)
- Collecte décrite en langage naturel, avec des colonnes suggérées par l'IA et modifiables
- Recherche web (Tavily) → lecture des pages → extraction selon le schéma, sans rien inventer
- Sans clé de recherche web : réponse tirée des connaissances du modèle, signalée « à vérifier » et à confiance plafonnée
- Fusion des doublons, conversion des nombres, niveau de confiance par ligne
- Vérification ligne par ligne (valider / rejeter) et correction des cases (double-clic)
- Export CSV (compatible Excel en français) et JSON
- Notifications dans l'application
- Garde-fous : quota de collectes par jour et par utilisateur, une collecte à la fois,
  plafond global d'appels IA par jour, limite de tentatives de connexion par IP,
  journal de chaque appel IA (`llm_usage`)

## Démarrer en local

Prérequis : Node.js ≥ 22 et Docker.

```bash
npm install
cp .env.example .env.local      # puis remplir les clés (voir ci-dessous)
npm run db:up                   # PostgreSQL local (port 5544)
npm run db:push                 # crée les tables
npm run dev                     # http://localhost:3000
```

### Clés à obtenir (offres gratuites)

| Variable | Où l'obtenir |
|---|---|
| `LLM_API_KEY` | https://console.groq.com → API Keys (ou OpenRouter, Cerebras…) |
| `TAVILY_API_KEY` | https://tavily.com → Dashboard |
| `GOOGLE_CLIENT_ID/SECRET` | Google Cloud Console → Identifiants OAuth (facultatif) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare → Turnstile (facultatif) |

Pour changer de fournisseur d'IA, il suffit de modifier `LLM_BASE_URL`, `LLM_MODEL` et
`LLM_API_KEY` : toute API compatible OpenAI fonctionne (Groq, OpenRouter, Cerebras,
Mistral, Ollama…).

## Déployer (Vercel + Supabase)

1. Crée un projet Supabase et copie l'URL de connexion **Session pooler** dans `DATABASE_URL`.
2. Applique le schéma : `DATABASE_URL=… npm run db:migrate` (fichiers dans `drizzle/`).
3. Importe le dépôt dans Vercel, ajoute les variables d'environnement et mets
   `BETTER_AUTH_URL` à l'URL publique du site.

## Architecture

```
src/
  app/                    pages (accueil, connexion, tableau de bord, collectes) et routes API
  components/             interface (formulaire de collecte, tableau de résultats, notifications…)
  db/schema.ts            tables : user/session/account/verification, collectes, rows, llm_usage, notifications
  lib/engine.ts           moteur : planifier les recherches → chercher → extraire → fusionner
  lib/llm.ts              client IA compatible OpenAI (réessais automatiques sur 429)
  lib/connectors/         sources de données (Tavily pour l'instant)
  lib/quotas.ts           limites et garde-fous
  lib/config.ts           paramètres lus depuis l'environnement
```

**Ajouter une source** (Wikidata, OpenStreetMap, fichiers PDF/Excel…) : créer un connecteur
qui respecte l'interface `Connector` de `src/lib/connectors/types.ts`.

## Feuille de route

- **V2** : formule premium avec un modèle plus puissant (recherche approfondie), système de crédits, suivi des coûts,
  connecteurs Wikidata et OpenStreetMap, carte, export Excel
- **V3** : paiement Mobile Money (MTN / Airtel), modèles de collecte réutilisables, tableau de bord
  administrateur, envoi vers une base externe ou un webhook, collectes planifiées

> Les collectes tournent en arrière-plan grâce à `after()` de Next.js (5 minutes maximum).
> Pour des collectes plus longues, il faudra une vraie file de tâches (Inngest, Trigger.dev…).
