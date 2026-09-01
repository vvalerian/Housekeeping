# Housekeeping

Application de suivi des interventions ménagères d'un foyer. **La source de vérité produit est [SPEC.md](SPEC.md)** — le lire avant toute évolution. Les écarts assumés vis-à-vis de la spec et les choix de sémantique sont consignés dans [DECISIONS.md](DECISIONS.md).

## Structure

Monorepo npm workspaces :

- `packages/core` — domaine pur : schémas Zod, catalogue initial (seed), configuration du foyer, **moteur de planification** (`src/planifier.ts`, fonction pure sans I/O — ne jamais y introduire d'accès base, d'horloge ou de réseau) et génération du calendrier. Toute la logique métier testable vit ici.
- `packages/server` — API HTTP (Hono), persistance SQLite (better-sqlite3 + Drizzle), seed exécutable.

## Points d'attention

- **Questions ouvertes non tranchées** : bloc `A_CONFIRMER` dans `packages/core/src/configuration.ts` (draps, rotation vitres, jours d'intervention, langue). Valeurs par défaut provisoires, à confirmer avec les employeurs et l'intervenante.
- Tous les réglages du moteur (`seuil_eligibilite`, etc.) et l'ordre des pièces vivent dans `packages/core/src/configuration.ts` — fichier unique, ne pas disperser.
- Les dates calendaires sont des chaînes `AAAA-MM-JJ` comparées lexicographiquement ; pas d'objets `Date` dans le domaine.

## Commandes

```
npm install            # à la racine
npm test               # tests de tous les workspaces (moteur + intégration API)
npm run typecheck
npm run db:seed        # crée data/housekeeping.db et charge le catalogue (--reset pour repartir de zéro)
npm run dev            # démarre l'API sur :3000
```

## Avancement

- **Lot 1 livré** : modèle de données, seed, moteur `planifier()` + tests, API. Aucun écran (conforme SPEC §11).
- Lots 2 à 4 (tablette, espace employeur, hors ligne/PWA/i18n/kiosque) : à venir, cf. SPEC §11. L'authentification (PIN tablette, identifiants employeurs) arrive avec les lots 2/3.
