# Décisions d'implémentation — Lot 1

Ce fichier consigne les choix faits là où [SPEC.md](SPEC.md) laisse une latitude, et les extensions minimales au modèle de données. À relire avant de modifier le moteur.

## Questions ouvertes (SPEC §12) — TRANCHÉES le 2026-09-04 par les employeurs

Les quatre points sont portés par le bloc `CHOIX_FOYER` de `packages/core/src/configuration.ts` (anciennement `A_CONFIRMER`), désormais **validés** :

1. **Cible de rotation des draps** : `ensemble_des_lits` — les trois chambres en une fois, une fois par mois, sur un passage B (conforme au défaut de SPEC §4.4). L'alternative `rotation_par_chambre` reste implémentée.
2. **Pièces incluses dans la rotation des vitres** : atelier, bureau, les trois chambres, cuisine, salon, salle à manger (8 pièces) ; sanitaires et circulations exclus.
3. **Jours d'intervention** : lundi et jeudi (le type A/B découle de l'alternance stricte).
4. **Langue de l'intervenante** : français uniquement — pas de seconde langue à prévoir. i18next reste introduit au lot 2 pour l'extraction des chaînes (exigence SPEC §6), avec la seule locale `fr`.

## Terminologie des pièces (2026-09-04)

Le vocabulaire réel du foyer diffère de SPEC §3.1, qui est conservé verbatim ; le code utilise les noms réels. Correspondance :

| SPEC §3.1 | Réel (id / nom) | Détail |
|---|---|---|
| Salon (24 m²) | `salle_a_manger` / Salle à manger | grande pièce entre la cuisine et le salon, condamnée pendant les travaux, fusionnera avec le salon |
| Pièce attenante (12 m²) | `salon` / Salon | canapé + étendoir (en attendant les travaux), condamné pendant les travaux |
| Bureau de Madame (17 m²) | `atelier` / Atelier | contient le poste de télétravail de Madame |
| Bureau de Monsieur (9 m²) | `bureau` / Bureau | |

Les autres pièces sont inchangées. Toute référence de la SPEC à « salon + pièce attenante » (mode travaux §7, sols zone jour §4.2) se lit donc « salle à manger + salon ».

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

## Lot 2 — interface tablette (choix d'implémentation)

- **Authentification reportée au lot 3** : le PIN tablette (SPEC §2/§9) et les comptes employeurs seront implémentés ensemble, côté serveur. Pendant les lots 1-2, l'API et l'interface ne sont exposées que sur le réseau local du foyer ; l'accès distant (Tailscale) arrive au lot 4.
- **Menu « je n'ai pas pu faire »** : ouvert par une icône dédiée (✋) plutôt qu'un appui long — la spec propose l'un ou l'autre, l'icône est plus découvrable et évite les conflits tactiles. Le menu impose un motif (c'est sa raison d'être : le repêchage en dépend) et propose « Pas fait » / « Fait en partie » ainsi qu'un commentaire facultatif.
- **Cartes de pièce dépliées par défaut** : l'intervenante voit tout le plan sans un tap ; chaque carte reste repliable.
- **Basculer une ligne** : un tap passe la tâche à `faite` (depuis n'importe quel état), un tap sur une tâche faite la remet `a_faire` ; les états fins passent par le menu motifs.
- **Ajout spontané** : bouton « + Ajouter une tâche » en fin de plan (libellé libre, sans pièce) — le modèle le prévoyait (`origine: ajout_spontane`), l'écran reste minimal.
- **Écran maintenu allumé** : Wake Lock API quand l'intervention est `en_cours` ; le mode kiosque du lot 4 (tablette branchée secteur) prendra le relais.
- **Servir l'interface** : le serveur sert `packages/tablette/dist` quand il existe (même origine pour l'app et l'API) ; en développement, Vite proxifie `/api` vers `:3000`.
- Le hors ligne (file d'écritures, PWA) reste au lot 4 : toute la conversation réseau est déjà isolée dans `packages/tablette/src/api.ts` pour s'y insérer sans toucher aux écrans.

## Exposition publique (2026-09-07, demande des employeurs)

L'application est publiée sur `https://housekeeping.vv-architech.fr` derrière le nginx du foyer — c'est une divergence assumée avec SPEC §9, qui recommandait un accès distant via Tailscale sans ouverture de port. Garde-fous (cf. `deploy/`) :

- le conteneur n'écoute que sur `127.0.0.1:3000` (jamais exposé directement) ;
- TLS Let's Encrypt, redirection 80 → 443 ;
- **Basic Auth nginx transitoire et obligatoire** tant que l'application n'a pas sa propre authentification — à retirer au déploiement du lot 3 (PIN tablette + comptes employeurs) ;
- sauvegarde quotidienne à chaud (`db:backup`, rétention 30 j) branchée sur cron, conformément à SPEC §8.

## Divers

- Le mode « travaux » actuel (salle à manger + salon condamnés, SPEC §3.1) est appliqué par le seed comme une période d'inactivité ouverte débutant au 2026-08-01 (constante `TRAVAUX_EN_COURS` de la configuration). Réactivation via l'API (`fin` posée) ou, plus tard, l'espace employeur.
- Branche unique `claude/housekeeping-specs-p5sgwt` imposée par la session pour ce lot (la spec §12 suggérait une branche par lot).
