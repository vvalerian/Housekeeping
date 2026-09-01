/**
 * ============================================================================
 * CONFIGURATION DU FOYER — FICHIER UNIQUE (SPEC.md §12)
 * ============================================================================
 *
 * Tout ce qui est réglable sans toucher au code métier vit ici : les paramètres
 * du moteur de planification, l'ordre des pièces, les jours d'intervention et
 * les quatre questions ouvertes de la spec. Le moteur (`planifier.ts`) reçoit
 * ces valeurs en entrée et n'importe jamais ce fichier : les tests lui passent
 * leurs propres réglages.
 */
import type { JourSemaine } from './dates.js'
import type { ParametresPlanification } from './domaine.js'

/**
 * Paramètres du moteur de planification (SPEC §5, étape 2).
 */
export const PARAMETRES_PLANIFICATION: ParametresPlanification = {
  /**
   * Ratio de retard minimal (`r = jours_depuis_derniere_execution / periode`)
   * pour qu'une tâche tournante soit candidate. À 0.8, une mensuelle redevient
   * candidate au bout de 24 jours, une trimestrielle au bout de 72.
   */
  seuil_eligibilite: 0.8,

  /** Nombre maximal de tâches tournantes retenues par intervention. */
  max_rotatives_par_intervention: 1,

  /**
   * L'arriéré est le nombre de candidates réellement en retard (`r >= 1`).
   * S'il dépasse STRICTEMENT ce seuil (« dépasse 3 », SPEC §5), une tâche
   * tournante supplémentaire est autorisée (soit 2 au total).
   */
  seuil_arriere: 3,

  /** Période de référence d'une tâche `mensuelle`, en jours. */
  periode_mensuelle_jours: 30,

  /** Période de référence d'une tâche `trimestrielle`, en jours. */
  periode_trimestrielle_jours: 90,
}

/**
 * Ordre d'affichage des pièces (cartes de l'écran tablette, groupement du plan).
 * Le seed en dérive `ordre_affichage` ((index + 1) × 10) ; modifiable ensuite
 * pièce par pièce depuis l'espace employeur.
 */
export const ORDRE_PIECES = [
  'cuisine',
  'salon',
  'piece_attenante',
  'couloir',
  'entree_1',
  'entree_2',
  'bureau_madame',
  'bureau_monsieur',
  'salle_de_bain',
  'wc_salle_de_bain',
  'salle_de_douche',
  'wc_salle_de_douche',
  'chambre_enfant_1',
  'chambre_enfant_2',
  'chambre_parents',
] as const

/**
 * ============================================================================
 * QUESTIONS OUVERTES (SPEC §12) — VALEURS PAR DÉFAUT PROVISOIRES, NON VALIDÉES
 * ============================================================================
 *
 * La spec demande de trancher ces quatre points avec les employeurs et
 * l'intervenante AVANT la mise en service. Les valeurs ci-dessous sont des
 * défauts raisonnables pour développer et tester ; elles sont volontairement
 * regroupées ici pour être introuvables nulle part ailleurs dans le code.
 * Voir DECISIONS.md.
 */
export const A_CONFIRMER = {
  /**
   * 1) Cible de rotation du changement des draps (SPEC §4.4).
   *    - 'ensemble_des_lits'    : tous les lits en une fois, une fois par mois
   *                               (défaut suggéré par la spec) ;
   *    - 'rotation_par_chambre' : une chambre différente à chaque occurrence.
   */
  cible_rotation_draps: 'ensemble_des_lits' as 'ensemble_des_lits' | 'rotation_par_chambre',

  /**
   * 2) Pièces incluses dans la rotation mensuelle des vitres (SPEC §4.4).
   *    Défaut : pièces de vie ; sanitaires et circulations exclus. À VALIDER.
   */
  pieces_rotation_vitres: [
    'cuisine',
    'salon',
    'piece_attenante',
    'bureau_madame',
    'bureau_monsieur',
    'chambre_enfant_1',
    'chambre_enfant_2',
    'chambre_parents',
  ] as string[],

  /**
   * 3) Jours d'intervention hebdomadaires (SPEC §5, génération du calendrier).
   *    Défaut : mardi (passage A) et vendredi (passage B). À VALIDER.
   */
  jours_intervention: ['mardi', 'vendredi'] as JourSemaine[],

  /** Type du tout premier passage si l'historique est vide. */
  premier_type_passage: 'A' as 'A' | 'B',

  /**
   * 4) Langue(s) de l'intervenante (SPEC §6). L'UI (lot 2) chargera i18next
   *    avec ces locales ; la seconde langue est À CONFIRMER avant de figer l'UI.
   */
  langues: ['fr'] as string[],
}

/**
 * Travaux en cours à la mise en service (SPEC §3.1 : salon et pièce attenante
 * « condamnés pendant les travaux »). Le seed pose sur ces pièces une période
 * d'inactivité ouverte ; la réactivation se fait via l'API (ou l'espace
 * employeur, lot 3) en fixant `fin`.
 */
export const TRAVAUX_EN_COURS = {
  piece_ids: ['salon', 'piece_attenante'] as string[],
  debut: '2026-08-01',
  motif: 'Travaux — pièce condamnée',
}
