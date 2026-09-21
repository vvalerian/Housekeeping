/**
 * ============================================================================
 * CONFIGURATION DU FOYER — FICHIER UNIQUE (SPEC.md §12)
 * ============================================================================
 *
 * Tout ce qui est réglable sans toucher au code métier vit ici : les paramètres
 * du moteur de planification, l'ordre des pièces, les jours d'intervention et
 * les choix propres au foyer. Le moteur (`planifier.ts`) reçoit ces valeurs en
 * entrée et n'importe jamais ce fichier : les tests lui passent leurs propres
 * réglages.
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
 *
 * Terminologie du foyer (précisée le 2026-09-04, cf. DECISIONS.md) : la
 * « salle à manger » est la grande pièce de 24 m² entre la cuisine et le salon
 * (la SPEC l'appelait « Salon ») ; le « salon » est l'espace de 12 m² avec le
 * canapé et l'étendoir (la SPEC l'appelait « Pièce attenante ») ; l'« atelier »
 * est la pièce de 17 m² de Madame, qui contient son poste de télétravail (la
 * SPEC l'appelait « Bureau de Madame ») ; le « bureau » est celui de Monsieur
 * (9 m²).
 */
export const ORDRE_PIECES = [
  'cuisine',
  'salle_a_manger',
  'salon',
  'couloir',
  'entree_1',
  'entree_2',
  'atelier',
  'bureau',
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
 * CHOIX DU FOYER — les quatre questions ouvertes de SPEC §12, TRANCHÉES
 * le 2026-09-04 par les employeurs (draps, vitres, jours, langue).
 * ============================================================================
 */
export const CHOIX_FOYER = {
  /**
   * 1) Cible du changement des draps (SPEC §4.4) : tous les lits en une fois,
   *    une fois par mois, sur un passage B. L'alternative 'rotation_par_chambre'
   *    reste implémentée si le foyer change d'avis.
   */
  cible_rotation_draps: 'ensemble_des_lits' as 'ensemble_des_lits' | 'rotation_par_chambre',

  /**
   * 2) Pièces incluses dans la rotation mensuelle des vitres (SPEC §4.4) :
   *    atelier, bureau, les trois chambres, cuisine, salon, salle à manger.
   */
  pieces_rotation_vitres: [
    'cuisine',
    'salle_a_manger',
    'salon',
    'atelier',
    'bureau',
    'chambre_enfant_1',
    'chambre_enfant_2',
    'chambre_parents',
  ] as string[],

  /**
   * 3) Jours d'intervention hebdomadaires (SPEC §5, génération du calendrier) :
   *    lundi et jeudi. Le type (A/B) découle de l'alternance stricte.
   */
  jours_intervention: ['lundi', 'jeudi'] as JourSemaine[],

  /** Type du tout premier passage si l'historique est vide. */
  premier_type_passage: 'A' as 'A' | 'B',

  /**
   * 4) Langue de l'intervenante (SPEC §6) : portugais brésilien, confirmé le
   *    2026-09-21 (l'intervenante ne parle pas français). La tablette suit la
   *    langue de l'appareil (pt → interface et catalogue en portugais, repli
   *    français) ; l'espace employeur reste en français.
   */
  langues: ['fr', 'pt'] as string[],
}

/**
 * Travaux en cours à la mise en service (SPEC §3.1 : la grande pièce et le
 * salon « condamnés pendant les travaux » — ils fusionneront à terme). Le seed
 * pose sur ces pièces une période d'inactivité ouverte ; la réactivation se
 * fait via l'API (ou l'espace employeur, lot 3) en fixant `fin`.
 */
export const TRAVAUX_EN_COURS = {
  piece_ids: ['salle_a_manger', 'salon'] as string[],
  debut: '2026-08-01',
  motif: 'Travaux — pièce condamnée',
}
