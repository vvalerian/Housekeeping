# Housekeeping — Cahier des charges

Application de suivi des interventions ménagères. Document destiné à être fourni tel quel à Claude Code comme spécification de départ.

**Dépôt** : https://github.com/vvalerian/Housekeeping
**Dossier de travail local** : `/Users/valerianvives/Documents/GitHub/Housekeeping`

---

## 1. Contexte et objectif

Un foyer de quatre personnes (145 m², deux adultes en télétravail, deux enfants, un chien) fait intervenir une aide ménagère deux fois par semaine. Le périmètre est stable mais découpé en deux passages complémentaires, avec en plus des tâches mensuelles et trimestrielles en rotation. Aujourd'hui ce fonctionnement tient dans un e-mail : il faut le transformer en outil.

L'application est un **support de coordination**, pas un outil de contrôle. Elle sert à ce que l'intervenante sache sans réfléchir ce qui est prévu ce jour-là, que les tâches tournantes ne soient ni oubliées ni doublées, et que les deux parties puissent se transmettre des informations (un produit fini, une pièce condamnée, une demande ponctuelle) sans se croiser dans le couloir.

Ce cadrage est structurant pour les choix produit : pas de chronométrage, pas de photo avant/après obligatoire, pas de géolocalisation, pas de score de performance. La validation d'une tâche est déclarative et non contestée.

**Support principal** : une tablette Android fixe (10", mode kiosque) installée dans l'appartement, utilisée par l'intervenante.
**Support secondaire** : navigateur mobile/desktop pour les employeurs, en local et à distance.

---

## 2. Utilisateurs et cas d'usage

**L'intervenante** arrive, réveille la tablette, voit immédiatement la date, le type de passage du jour et la liste des tâches groupées par pièce. Elle coche au fur et à mesure, peut signaler un problème en deux touches, et clôture l'intervention. Elle ne se connecte pas au sens classique : la tablette est physiquement dans le logement, un code PIN à 4 chiffres suffit (et doit pouvoir être désactivé en configuration).

**Les employeurs** configurent les pièces et les tâches, désactivent temporairement une pièce pendant des travaux, ajoutent une demande ponctuelle pour la prochaine intervention, consultent l'historique, répondent aux signalements. Accès protégé par identifiant/mot de passe, sessions distinctes de celle de la tablette.

---

## 3. Modèle de données

### 3.1 Pièce (`Room`)

Champs : `id`, `nom`, `type` (cuisine / salon / chambre / bureau / sanitaire / circulation), `surface_m2` (nullable), `actif` (bool), `periodes_inactivite` (liste de `{debut, fin?, motif}`), `ordre_affichage`, `inclus_rotation_vitres` (bool).

Une pièce inactive retire automatiquement du planning toutes les tâches qui la ciblent, sans casser les compteurs de rotation : une tâche tournante dont la pièce est inactive est simplement sautée et repêchée à la réactivation.

Jeu de données initial :

| Pièce | Type | Surface | Notes |
|---|---|---|---|
| Cuisine | cuisine | — | plan de travail, plaques vitrocéramiques, four, micro-ondes, réfrigérateur, lave-vaisselle, évier, placards |
| Salon | salon | 24 m² | condamné pendant les travaux |
| Pièce attenante | salon | 12 m² | canapé + étendoir ; sol uniquement ; condamnée pendant les travaux ; fusionnera avec le salon |
| Couloir | circulation | — | |
| Entrée 1 | circulation | — | |
| Entrée 2 | circulation | — | |
| Bureau de Madame | bureau | 17 m² | libéré pendant l'intervention |
| Bureau de Monsieur | bureau | 9 m² | libéré pendant l'intervention |
| Salle de bain | sanitaire | — | baignoire, meuble double vasque |
| WC salle de bain | sanitaire | — | |
| Salle de douche | sanitaire | — | douche à parois, meuble vasque |
| WC salle de douche | sanitaire | — | |
| Chambre enfant 1 | chambre | 12 m² | linge de lit dans le placard de la chambre |
| Chambre enfant 2 | chambre | 12 m² | idem |
| Chambre parents | chambre | 14 m² | idem |

### 3.2 Définition de tâche (`TaskDefinition`)

Champs : `id`, `libelle`, `room_id` (nullable pour les tâches transverses), `checklist` (liste de sous-points affichés en détail, non cochables individuellement), `cadence` (`chaque_passage` | `passage_A` | `passage_B` | `mensuelle` | `trimestrielle`), `duree_estimee_min` (indicative, jamais affichée à l'intervenante), `cible_rotative` (nullable : mécanisme de sous-rotation, cf. §4.3), `instructions` (texte libre, produit à utiliser, précaution), `actif`.

### 3.3 Intervention

Champs : `id`, `date`, `type` (`A` | `B` | `exceptionnelle`), `statut` (`planifiee` | `en_cours` | `cloturee` | `annulee`), `heure_debut`, `heure_fin`, `note_intervenante`, `note_employeur`.

### 3.4 Instance de tâche (`TaskInstance`)

Champs : `id`, `intervention_id`, `task_definition_id`, `room_id_effectif`, `statut` (`a_faire` | `faite` | `partielle` | `non_faite`), `motif_non_faite` (`manque_de_temps` | `piece_inaccessible` | `produit_manquant` | `non_necessaire` | `autre`), `commentaire`, `horodatage_validation`, `origine` (`plan` | `rotation` | `ponctuelle` | `ajout_spontane`).

### 3.5 Autres entités

`Signalement` (type : casse / produit à racheter / problème technique / autre ; texte ; statut ouvert-traité ; réponse employeur). `DemandePonctuelle` (texte, intervention cible ou « prochaine », créée par les employeurs, devient une `TaskInstance` d'origine `ponctuelle`). `Produit` (stock de consommables ménagers, niveau ok / bas / épuisé, mis à jour d'une touche par l'intervenante). `Message` (fil de discussion simple et horodaté, sans notification push obligatoire).

---

## 4. Catalogue des tâches (données de seed)

À implémenter en seed exécutable (`seed.ts` ou fixtures SQL), modifiable ensuite depuis l'espace employeur sans redéploiement.

### 4.1 À chaque passage (cadence `chaque_passage`)

**Cuisine** — sol ; plaques vitrocéramiques ; plan de travail ; évier ; façades de placards.
**Lave-vaisselle** — le vider s'il est propre, y mettre la vaisselle sale, le lancer s'il est plein.
**Linge** — étendre ce qui sort du lave-linge ; plier et ranger ce qui est sec sur l'étendoir ; plier et ranger ce qui sort du sèche-linge. *Note affichée : les machines sont lancées par les employeurs avant l'intervention.*
**Poubelles** — sortie des ordures ménagères et du recyclable, changement de sac.
**Rangement léger** — vaisselle qui traîne, coussins du canapé, jouets rapportés dans les chambres des enfants autant que possible.

### 4.2 Passage 1 — zone jour, bureaux, salle de bain (cadence `passage_A`)

**Salle de bain, nettoyage complet** — baignoire et joints ; meuble double vasque ; robinetterie ; miroir.
**WC de la salle de bain** — nettoyage complet.
**Sols zone jour** — salon, pièce attenante, cuisine, couloir, deux entrées.
**Dépoussiérage zone jour** — meubles.
**Bureau de Madame** — aspiration, lavage du sol, dépoussiérage.
**Bureau de Monsieur** — aspiration, lavage du sol, dépoussiérage.

### 4.3 Passage 2 — chambres et salle de douche (cadence `passage_B`)

**Salle de douche, nettoyage complet** — douche, parois et joints ; meuble vasque ; robinetterie ; miroir.
**WC de la salle de douche** — nettoyage complet.
**Chambre enfant 1** — rangement, dépoussiérage, aspiration, lavage du sol, lit refait.
**Chambre enfant 2** — idem.
**Chambre des parents** — rangement léger, dépoussiérage, aspiration, lavage du sol, lit refait.
**Sols zone jour** — passage rapide d'entretien.

### 4.4 Rotation mensuelle (cadence `mensuelle`, une occurrence par mois chacune)

**Changement des draps** — linge de lit disponible dans le placard de la chambre concernée, service libre. *Cible rotative : les trois chambres à tour de rôle ? À trancher à la configuration — par défaut, considérer la tâche comme portant sur l'ensemble des lits, une fois par mois, planifiée sur un passage 2.*
**Vitres** — une pièce différente chaque mois, curseur circulaire sur les pièces marquées `inclus_rotation_vitres`.
**Nettoyage des contenants à poubelles de la cuisine.**
**Aspiration du canapé** — assises et dessous des coussins.

### 4.5 Rotation trimestrielle (cadence `trimestrielle`, une occurrence par trimestre chacune)

**Intérieur du four ou du micro-ondes** — cible alternée d'un trimestre à l'autre.
**Intérieur du réfrigérateur.**
**Plinthes, traces sur les portes, poignées et interrupteurs.**
**Bac à lessive et joint de hublot du lave-linge.**

---

## 5. Moteur de planification

C'est le cœur du projet et le seul endroit où il faut être rigoureux. Il doit être implémenté en fonction pure, testée unitairement, indépendante de l'UI et de la base.

```
planifier(date, type_passage, historique, configuration) -> TaskInstance[]
```

**Étape 1 — socle.** Sélectionner les tâches de cadence `chaque_passage`, plus celles du type de passage demandé. Écarter toute tâche dont la pièce est inactive à cette date.

**Étape 2 — tâches tournantes.** Pour chaque tâche de cadence `mensuelle` ou `trimestrielle`, calculer un ratio de retard `r = jours_depuis_derniere_execution / periode_en_jours` (`r = +∞` si jamais exécutée). Ne retenir que les candidates avec `r >= seuil_eligibilite` (défaut `0.8`) et dont la pièce cible est active. Trier par `r` décroissant et retenir au maximum `max_rotatives_par_intervention` (défaut : **1**). Autoriser 2 si l'arriéré dépasse `seuil_arriere` (défaut : 3 tâches en retard).

Le calcul se fait **sur la date de dernière exécution réelle**, jamais sur un calendrier théorique. C'est ce qui permet aux vacances, jours fériés et annulations de ne rien dérégler.

**Étape 3 — sous-rotation de cible.** Pour les tâches à `cible_rotative` (vitres, four/micro-ondes, éventuellement draps), résoudre la cible en avançant le curseur circulaire à partir de la dernière cible traitée, en sautant les pièces inactives.

**Étape 4 — demandes ponctuelles.** Injecter les `DemandePonctuelle` en attente rattachées à cette intervention ou marquées « prochaine ».

**Étape 5 — repêchage.** Toute `TaskInstance` de la dernière intervention en statut `non_faite` ou `partielle` avec le motif `manque_de_temps` ou `piece_inaccessible` est réinjectée avec un bandeau « reportée depuis le [date] », et son ratio de retard est majoré de `+0.5` pour la sélection des rotatives.

**Étape 6 — ordonnancement.** Grouper par pièce, dans l'ordre d'affichage configuré, en terminant par les tâches transverses (linge, poubelles) qui se font plutôt en fin d'intervention.

**Volumétrie cible** : 9 à 12 cartes de pièce par intervention, une tâche tournante au plus. Si le plan généré dépasse durablement ce volume, c'est le découpage des tâches qui est trop fin, pas le moteur.

**Génération du calendrier** : deux interventions par semaine, jours configurables, alternance stricte A/B. Une intervention annulée ne consomme pas son tour d'alternance — la suivante reprend le type qui n'a pas eu lieu.

---

## 6. Interface tablette

Écran d'accueil : la date, le type de passage en clair (« Passage 2 — chambres et salle de douche »), un bouton unique « Commencer », et le cas échéant un encart avec les messages ou demandes des employeurs.

Écran principal : une carte par pièce, dépliable. Le titre de la carte porte le nom de la pièce, la carte contient les tâches sous forme de lignes cochables, et chaque ligne peut se déplier pour révéler la checklist de détail et les instructions. Un appui long ou une icône dédiée ouvre le menu « je n'ai pas pu faire » avec les motifs prédéfinis. Une barre de progression discrète en haut, jamais de compte à rebours ni de durée affichée.

Bouton flottant permanent « Signaler » : casse, produit à racheter, problème technique, autre. Deux touches maximum jusqu'à la saisie.

Écran de clôture : récapitulatif de ce qui est fait et de ce qui ne l'est pas, champ de note libre optionnel, bouton « Terminer ». Aucun blocage si des tâches restent non cochées.

Contraintes d'ergonomie : cibles tactiles de 56 px minimum, typographie de 18 px minimum, contraste WCAG AA, aucune interaction dépendant du survol, fonctionnement en portrait comme en paysage, écran maintenu allumé pendant une intervention en cours, aucun scroll horizontal.

**Internationalisation** : prévoir i18next dès le premier commit, avec extraction complète des chaînes. La langue est un paramètre de l'appareil, pas de l'application. Prévoir français plus une langue à confirmer avec l'intervenante ; c'est un point à vérifier avant de figer l'UI, pas après.

---

## 7. Interface employeur

Configuration des pièces (création, surface, activation/désactivation avec période et motif, ordre d'affichage, inclusion dans la rotation des vitres). Configuration des tâches (libellé, checklist, cadence, pièce, instructions, activation). Calendrier des interventions avec possibilité d'annuler, déplacer ou ajouter une intervention exceptionnelle. Ajout de demandes ponctuelles. Historique consultable par intervention et par tâche, avec vue « dernière exécution » de chaque tâche tournante — c'est la vue qui répond à la question « ça fait combien de temps qu'on n'a pas fait le frigo ? ». Fil de messages et traitement des signalements. Suivi des consommables.

Un mode « travaux » d'un clic : désactiver le salon, la pièce attenante et éventuellement un bureau sur une période donnée, avec réactivation automatique à échéance et rappel.

---

## 8. Exigences non fonctionnelles

**Hors ligne d'abord.** L'application doit fonctionner intégralement sans réseau pendant toute une intervention : plan du jour préchargé, validations stockées localement, synchronisation opportuniste à la reconnexion. Une coupure Wi-Fi ne doit jamais faire perdre une heure de travail coché. File d'écritures persistante en IndexedDB, réconciliation par horodatage au niveau de la `TaskInstance` (dernier écrivain gagne, les conflits réels sont improbables sur ce volume).

**PWA installable**, démarrage à froid sous 2 secondes sur matériel modeste.

**Données personnelles** : aucune donnée sensible, aucun traçage, pas d'analytics tiers. Hébergement recommandé sur machine domestique.

**Sauvegarde** : dump quotidien de la base, rétention 30 jours.

**Tests** : couverture prioritaire sur le moteur de planification (cas nominal, pièce désactivée, intervention annulée, arriéré, curseur de vitres sautant une pièce inactive, reprise après trois semaines d'absence). Le reste peut se contenter de tests d'intégration légers.

---

## 9. Pile technique proposée

Front en React + TypeScript sur Vite, Tailwind, TanStack Query, Dexie pour la file hors ligne, `vite-plugin-pwa` pour le service worker, i18next. Back en Hono ou Fastify sur Node, SQLite via `better-sqlite3` et Drizzle, schémas Zod partagés entre client et serveur dans un package commun. Authentification par PIN à durée de session longue et jeton lié à l'appareil pour la tablette, identifiant/mot de passe classique pour les employeurs.

Déploiement en conteneur sur NAS ou mini-PC domestique, reverse proxy Caddy avec TLS local, accès distant via Tailscale plutôt que par ouverture de port.

Ces choix sont des recommandations, pas des contraintes : toute pile équivalente convient tant que le moteur de planification reste isolé et testable et que le hors ligne est réel.

---

## 10. Hors périmètre

Paie, déclaration CESU, décompte d'heures à valeur contractuelle. Photos avant/après. Chronométrage des tâches. Notation ou évaluation de la prestation. Notifications push intrusives. Gestion multi-logements ou multi-intervenants — l'architecture ne doit pas s'interdire l'extension, mais la v1 ne l'implémente pas.

---

## 11. Découpage proposé

**Lot 1** — modèle de données, seed complet du catalogue, moteur de planification et sa suite de tests, API. Aucun écran. C'est le lot le plus long et le seul où une erreur coûte cher.
**Lot 2** — interface tablette : accueil, plan du jour, validation, clôture, signalements.
**Lot 3** — interface employeur : configuration, calendrier, historique, mode travaux, messages.
**Lot 4** — hors ligne, PWA, internationalisation, mise en mode kiosque de la tablette (Fully Kiosk Browser ou équivalent, application épinglée, écran maintenu allumé sur secteur).

---

## 12. Instructions à Claude Code

Le projet vit dans `/Users/valerianvives/Documents/GitHub/Housekeeping`, rattaché au dépôt distant https://github.com/vvalerian/Housekeeping. Travailler directement dans ce dossier, sur une branche par lot, et conserver ce cahier des charges à la racine sous `SPEC.md` avec un `CLAUDE.md` court renvoyant vers lui. Le nom affiché de l'application est **Housekeeping**.

Commencer par le lot 1 et ne rien afficher tant que `planifier()` ne passe pas ses tests. Poser les questions ouvertes avant de coder : la cible de rotation des draps, la liste des pièces incluses dans la rotation des vitres, les deux jours d'intervention hebdomadaires, la langue de l'intervenante. Ne pas inventer de valeur par défaut sur ces quatre points sans le signaler explicitement dans le code.

Écrire la configuration (`seuil_eligibilite`, `max_rotatives_par_intervention`, `seuil_arriere`, jours d'intervention, ordre des pièces) dans un fichier unique et documenté, modifiable sans toucher au code métier.

Préférer une base simple et lisible à une abstraction générique. Le domaine est petit et connu ; le sur-dimensionner est le principal risque du projet.
