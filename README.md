# Housekeeping

Application de suivi des interventions ménagères d'un foyer : plan du jour sur
tablette pour l'intervenante, configuration et historique pour les employeurs,
tâches mensuelles et trimestrielles en rotation automatique.

- **Spécification produit** : [SPEC.md](SPEC.md)
- **Décisions d'implémentation** : [DECISIONS.md](DECISIONS.md)
- **Repères pour Claude Code** : [CLAUDE.md](CLAUDE.md)

## Démarrage

```bash
npm install
npm test              # moteur de planification + intégration API
npm run db:seed       # charge le catalogue initial (pièces + tâches)
npm run dev           # API sur http://localhost:3000
```

## Structure

| Package | Rôle |
|---|---|
| `packages/core` | Domaine pur : schémas Zod, catalogue, configuration du foyer, moteur `planifier()` et calendrier — testés unitairement, sans I/O. |
| `packages/server` | API HTTP (Hono) + SQLite (better-sqlite3 / Drizzle), seed exécutable. |

Les quatre questions ouvertes de la spec (draps, rotation des vitres, jours
d'intervention, langue de l'intervenante) sont **tranchées** et regroupées dans
le bloc `CHOIX_FOYER` de `packages/core/src/configuration.ts` : draps sur
l'ensemble des lits (passage B), vitres sur huit pièces, interventions le lundi
et le jeudi, français uniquement.

État : **lot 1 livré** (modèle, seed, moteur testé, API). Lots suivants : cf. [SPEC.md](SPEC.md) §11.
