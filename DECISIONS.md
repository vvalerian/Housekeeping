# Décisions d'implémentation — Lot 1

Ce fichier consigne les choix faits là où [SPEC.md](SPEC.md) laisse une latitude, et les extensions minimales au modèle de données. À relire avant de modifier le moteur.

## Questions ouvertes (SPEC §12) — défauts provisoires, signalés dans le code

Les quatre points que la spec demande de trancher avec les intéressés sont portés par le bloc `A_CONFIRMER` de `packages/core/src/configuration.ts`, avec des valeurs par défaut **provisoires** :

1. **Cible de rotation des draps** : `ensemble_des_lits` (le défaut suggéré par SPEC §4.4 — tous les lits en une fois, une fois par mois, sur un passage B). L'alternative `rotation_par_chambre` est implémentée et se choisit dans la configuration.
2. **Pièces incluses dans la rotation des vitres** : toutes les pièces de vie (cuisine, salon, pièce attenante, deux bureaux, trois chambres) ; sanitaires et circulations exclus. Pur choix par défaut, à valider.
3. **Jours d'intervention** : mardi et vendredi. À valider.
4. **Langue de l'intervenante** : `fr` seul pour l'instant ; la seconde langue reste à confirmer **avant de figer l'UI** (lot 2). i18next sera introduit avec le premier écran — le lot 1 n'a aucune chaîne d'interface, les libellés du catalogue sont des données éditables, pas des chaînes d'UI.

## Extensions au modèle de données (par rapport à SPEC §3)

- `TaskDefinition.passage_contraint` (`'A' | 'B' | null`) : restreint une tâche tournante à un type de passage. Nécessaire pour « draps […] planifiée sur un passage 2 » (SPEC §4.4).
- `TaskInstance.cible_resolue` (`string | null`) : mémorise la cible résolue d'une sous-rotation (id de pièce pour les vitres, valeur de liste pour four/micro-ondes). Sans elle, impossible d'avancer le curseur « à partir de la dernière cible traitée » (SPEC §5 étape 3).
- `TaskInstance.reportee_depuis` (`date | null`) : porte le bandeau « reportée depuis le [date] » (SPEC §5 étape 5).
- `TaskInstance.task_definition_id` rendu nullable + `TaskInstance.demande_ponctuelle_id` + `TaskInstance.libelle` (instantané) : une demande ponctuelle ou un ajout spontané n'a pas de définition de tâche. Le libellé est figé à la planification, l'historique reste lisible même si la définition est modifiée ensuite.

## Sémantique du moteur (interprétations de SPEC §5)

- **« Dernière exécution réelle » = dernière instance en statut `faite`** (intervention non annulée). `partielle` ne remet pas le compteur à zéro et n'avance pas le curseur de sous-rotation — une rotation à moitié faite revient sur la même cible.
- **Repêchage des rotatives** : une tâche `mensuelle`/`trimestrielle` non faite (motif temps/accès) n'est **pas** réinjectée d'office par l'étape 5 ; elle repasse par la sélection de l'étape 2 avec son ratio majoré de `+0.5`, dans la limite du plafond. C'est la lecture qui préserve la volumétrie « une tâche tournante au plus ». Les tâches non rotatives (socle, ponctuelles, ajouts spontanés), elles, sont réinjectées directement — sans doublon si l'étape 1 les fournit déjà (elles portent alors seulement le bandeau).
- **« Dernière intervention » du repêchage = dernière intervention `cloturee`** ; une annulée intercalée est ignorée.
- **Arriéré** : nombre de candidates éligibles avec `r >= 1` ; le plafond passe à 2 si l'arriéré dépasse **strictement** `seuil_arriere` (« dépasse 3 »).
- **Égalité de ratio** (dont plusieurs `+∞` au démarrage) : départage par ordre du catalogue, déterministe.
- **Périodes** : mensuelle = 30 jours, trimestrielle = 90 jours (configurables).
- **Intervention `exceptionnelle`** : socle = `chaque_passage` uniquement (ni A ni B) ; les rotatives éligibles restent sélectionnables (lecture littérale de l'étape 2, absorbe l'arriéré), sauf contrainte de passage (les draps n'y tombent jamais).
- **Curseur de sous-rotation** : liste des pièces à vitres triée par `ordre_affichage` ; si la dernière cible traitée a disparu de la liste, on repart de la première pièce active ; si plus aucune cible n'est active, la tâche n'est pas éligible.
- **Période d'inactivité** : bornes incluses (`debut <= date <= fin`), `fin` nulle = jusqu'à nouvel ordre. La réactivation est effective le lendemain de `fin`.
- **Clôture** : les instances restées `a_faire` passent à `non_faite` avec motif nul (« non renseigné »). Sans motif temps/accès, elles ne sont pas repêchées — cohérent avec la validation déclarative non contestée (SPEC §1).
- **Demandes ponctuelles** : le filtrage « rattachées à cette intervention ou marquées prochaine » est fait par l'appelant (le serveur) ; le moteur injecte ce qu'on lui donne. Une demande arrivée après la génération du plan est ajoutée au plan existant au prochain chargement.

## Divers

- Le mode « travaux » actuel (salon + pièce attenante condamnés, SPEC §3.1) est appliqué par le seed comme une période d'inactivité ouverte débutant au 2026-08-01 (constante `TRAVAUX_EN_COURS` de la configuration). Réactivation via l'API (`fin` posée) ou, plus tard, l'espace employeur.
- Branche unique `claude/housekeeping-specs-p5sgwt` imposée par la session pour ce lot (la spec §12 suggérait une branche par lot).
