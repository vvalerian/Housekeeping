# Housekeeping

Application de suivi des interventions ménagères d'un foyer. **La source de vérité produit est [SPEC.md](SPEC.md)** — le lire avant toute évolution. Les écarts assumés vis-à-vis de la spec et les choix de sémantique sont consignés dans [DECISIONS.md](DECISIONS.md).

## Structure

Monorepo npm workspaces :

- `packages/core` — domaine pur : schémas Zod, catalogue initial (seed), configuration du foyer, **moteur de planification** (`src/planifier.ts`, fonction pure sans I/O — ne jamais y introduire d'accès base, d'horloge ou de réseau) et génération du calendrier. Toute la logique métier testable vit ici.
- `packages/server` — API HTTP (Hono), persistance SQLite (better-sqlite3 + Drizzle), seed exécutable. Sert aussi le build de la tablette (`packages/tablette/dist`) quand il existe.
- `packages/tablette` — interface tablette (React + Vite + Tailwind + TanStack Query + i18next). Réseau isolé dans `src/api.ts` (le hors ligne du lot 4 s'y branchera), logique d'affichage pure dans `src/lib.ts` (testée), chaînes toutes extraites dans `src/locales/fr.json`. Verrouillée par le PIN (écran `src/ecrans/Pin.tsx`).
- `packages/employeur` — espace employeur (React + Vite + Tailwind, français en dur — décision DECISIONS.md), servi sous `/admin` : calendrier, rotations, pièces (mode travaux), tâches, demandes, signalements, messages, produits, sécurité (PIN + comptes). Auth serveur dans `packages/server/src/auth.ts` (scrypt, sessions cookie, gardes `exigerEmployeur` / `exigerEcriture` — les comptes ont un rôle `employeur` ou `observateur`, ce dernier en lecture seule stricte côté serveur).

## Points d'attention

- **Les quatre questions ouvertes de SPEC §12 sont tranchées** : bloc `CHOIX_FOYER` dans `packages/core/src/configuration.ts` — draps sur l'ensemble des lits (passage B), vitres sur 8 pièces, interventions lundi et jeudi ; langue de l'intervenante : **portugais brésilien** (2026-09-21). Les données du catalogue sont bilingues (`nom_pt`, `libelle_pt`, `checklist_pt`, `instructions_pt`, repli français) ; la tablette suit la langue de l'appareil, l'admin reste en français ; `npm run db:traduire` complète une base existante.
- **Terminologie des pièces** : le code suit le vocabulaire réel du foyer, pas celui de SPEC §3.1 (conservé verbatim) — mapping dans DECISIONS.md : `salle_a_manger` (24 m², ex-« Salon »), `salon` (12 m², ex-« Pièce attenante »), `atelier` (17 m², ex-« Bureau de Madame »), `bureau` (9 m², ex-« Bureau de Monsieur »).
- Tous les réglages du moteur (`seuil_eligibilite`, etc.) et l'ordre des pièces vivent dans `packages/core/src/configuration.ts` — fichier unique, ne pas disperser.
- Les dates calendaires sont des chaînes `AAAA-MM-JJ` comparées lexicographiquement ; pas d'objets `Date` dans le domaine.

## Commandes

```
npm install            # à la racine
npm test               # tests de tous les workspaces (moteur + intégration API + lib tablette)
npm run typecheck
npm run db:seed        # crée data/housekeeping.db et charge le catalogue (--reset pour repartir de zéro)
npm run dev            # démarre l'API sur :3000 (sert aussi packages/tablette/dist s'il existe)
npm run dev:tablette   # Vite en développement (proxy /api vers :3000)
npm run build          # build tablette + espace employeur
```

## Déploiement

Production domestique : conteneur Docker (`docker-compose.yml` + `deploy/Dockerfile`, base SQLite dans `./data/`) derrière le nginx du foyer sur `https://housekeeping.vv-architech.fr` — marche à suivre, vhost et sauvegardes dans [deploy/README.md](deploy/README.md). Basic Auth nginx pendant l'installation, retiré une fois le premier compte employeur créé sur `/admin` (README §3).

## Avancement

- **Lot 1 livré** : modèle de données, seed, moteur `planifier()` + tests, API.
- **Lot 2 livré** : interface tablette — accueil, plan du jour par cartes de pièce, validation avec motifs, ajout spontané, clôture, bouton « Signaler », écran maintenu allumé, i18next (fr).
- **Lot 3 livré** : authentification (comptes employeurs, PIN tablette, sessions, cloisonnement des routes) + espace employeur `/admin` complet (SPEC §7). Déployé sur https://housekeeping.vv-architech.fr (Mac du foyer, cf. deploy/README.md).
- **Bilinguisme fr/pt-BR livré** (2026-09-21) + **PWA installable** (manifest, service worker, icônes — partie du lot 4).
- **Rôle observateur livré** (2026-09-21) : comptes en lecture seule pour la société de prestation (403 serveur sur toute écriture, UI `/admin` dégradée via `ContexteLectureSeule`, création/suppression dans Sécurité — voir DECISIONS.md).
- Reste du lot 4 : file d'écritures hors ligne (IndexedDB, à brancher dans `packages/tablette/src/api.ts`), mode kiosque de la tablette.
