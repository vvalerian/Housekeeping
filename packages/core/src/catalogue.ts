/**
 * Catalogue initial du foyer (SPEC.md §3.1 et §4) : les données que le seed
 * charge en base. Après le seed, la base fait foi — ce fichier n'est relu
 * qu'en cas de réinitialisation. Les identifiants sont des slugs stables,
 * référencés par la configuration et les tests.
 */
import { CHOIX_FOYER, ORDRE_PIECES } from './configuration.js'
import type { DefinitionTache, Piece } from './domaine.js'

// ---------------------------------------------------------------------------
// Pièces (SPEC §3.1)
// ---------------------------------------------------------------------------

interface EbauchePiece {
  id: string
  nom: string
  type: Piece['type']
  surface_m2?: number
}

// Terminologie du foyer (2026-09-04, cf. DECISIONS.md) : la SPEC §3.1 nommait
// « Salon » la salle à manger (24 m²), « Pièce attenante » le salon (12 m²,
// canapé + étendoir), « Bureau de Madame » l'atelier (17 m²) et « Bureau de
// Monsieur » le bureau (9 m²).
const EBAUCHES_PIECES: EbauchePiece[] = [
  { id: 'cuisine', nom: 'Cuisine', type: 'cuisine' },
  { id: 'salle_a_manger', nom: 'Salle à manger', type: 'salon', surface_m2: 24 },
  { id: 'salon', nom: 'Salon', type: 'salon', surface_m2: 12 },
  { id: 'couloir', nom: 'Couloir', type: 'circulation' },
  { id: 'entree_1', nom: 'Entrée 1', type: 'circulation' },
  { id: 'entree_2', nom: 'Entrée 2', type: 'circulation' },
  { id: 'atelier', nom: 'Atelier', type: 'bureau', surface_m2: 17 },
  { id: 'bureau', nom: 'Bureau', type: 'bureau', surface_m2: 9 },
  { id: 'salle_de_bain', nom: 'Salle de bain', type: 'sanitaire' },
  { id: 'wc_salle_de_bain', nom: 'WC salle de bain', type: 'sanitaire' },
  { id: 'salle_de_douche', nom: 'Salle de douche', type: 'sanitaire' },
  { id: 'wc_salle_de_douche', nom: 'WC salle de douche', type: 'sanitaire' },
  { id: 'chambre_enfant_1', nom: 'Chambre enfant 1', type: 'chambre', surface_m2: 12 },
  { id: 'chambre_enfant_2', nom: 'Chambre enfant 2', type: 'chambre', surface_m2: 12 },
  { id: 'chambre_parents', nom: 'Chambre parents', type: 'chambre', surface_m2: 14 },
]

/**
 * Pièces initiales, toutes actives et sans période d'inactivité : le mode
 * « travaux » courant est appliqué par le seed (cf. `TRAVAUX_EN_COURS`), pas
 * ici, pour que les tests du moteur partent d'un état neutre.
 */
export const PIECES_INITIALES: Piece[] = EBAUCHES_PIECES.map((e) => ({
  id: e.id,
  nom: e.nom,
  type: e.type,
  surface_m2: e.surface_m2 ?? null,
  actif: true,
  periodes_inactivite: [],
  ordre_affichage: (ORDRE_PIECES.indexOf(e.id as (typeof ORDRE_PIECES)[number]) + 1) * 10,
  inclus_rotation_vitres: CHOIX_FOYER.pieces_rotation_vitres.includes(e.id),
}))

// ---------------------------------------------------------------------------
// Tâches (SPEC §4) — l'ordre de déclaration sert d'ordre de présentation dans
// une carte de pièce et de départage déterministe entre rotatives à ratio égal.
// ---------------------------------------------------------------------------

interface EbaucheTache {
  id: string
  libelle: string
  room_id?: string
  checklist?: string[]
  cadence: DefinitionTache['cadence']
  duree_estimee_min?: number
  cible_rotative?: DefinitionTache['cible_rotative']
  passage_contraint?: 'A' | 'B'
  instructions?: string
}

/**
 * Cible du changement des draps (SPEC §4.4), pilotée par
 * `CHOIX_FOYER.cible_rotation_draps`. Choix validé : l'ensemble des lits en
 * une fois (pas de sous-rotation).
 */
const CIBLE_DRAPS: DefinitionTache['cible_rotative'] =
  CHOIX_FOYER.cible_rotation_draps === 'rotation_par_chambre'
    ? { type: 'pieces', piece_ids: ['chambre_enfant_1', 'chambre_enfant_2', 'chambre_parents'] }
    : null

const EBAUCHES_TACHES: EbaucheTache[] = [
  // --- À chaque passage (SPEC §4.1) ---
  {
    id: 'cuisine_nettoyage',
    libelle: 'Nettoyage de la cuisine',
    room_id: 'cuisine',
    cadence: 'chaque_passage',
    checklist: ['Sol', 'Plaques vitrocéramiques', 'Plan de travail', 'Évier', 'Façades de placards'],
    duree_estimee_min: 30,
  },
  {
    id: 'lave_vaisselle',
    libelle: 'Lave-vaisselle',
    room_id: 'cuisine',
    cadence: 'chaque_passage',
    checklist: ["Le vider s'il est propre", 'Y mettre la vaisselle sale', "Le lancer s'il est plein"],
    duree_estimee_min: 10,
  },
  {
    id: 'linge',
    libelle: 'Linge',
    cadence: 'chaque_passage',
    checklist: [
      'Étendre ce qui sort du lave-linge',
      "Plier et ranger ce qui est sec sur l'étendoir",
      'Plier et ranger ce qui sort du sèche-linge',
    ],
    instructions: "Les machines sont lancées par les employeurs avant l'intervention.",
    duree_estimee_min: 20,
  },
  {
    id: 'poubelles',
    libelle: 'Poubelles',
    cadence: 'chaque_passage',
    checklist: ['Sortir les ordures ménagères', 'Sortir le recyclable', 'Changer les sacs'],
    duree_estimee_min: 10,
  },
  {
    id: 'rangement_leger',
    libelle: 'Rangement léger',
    cadence: 'chaque_passage',
    checklist: [
      'Vaisselle qui traîne',
      'Coussins du canapé',
      'Jouets rapportés dans les chambres des enfants',
    ],
    instructions: 'Autant que possible, sans y passer trop de temps.',
    duree_estimee_min: 15,
  },

  // --- Passage 1 (A) — zone jour, bureaux, salle de bain (SPEC §4.2) ---
  {
    id: 'salle_de_bain_complet',
    libelle: 'Nettoyage complet de la salle de bain',
    room_id: 'salle_de_bain',
    cadence: 'passage_A',
    checklist: ['Baignoire et joints', 'Meuble double vasque', 'Robinetterie', 'Miroir'],
    duree_estimee_min: 30,
  },
  {
    id: 'wc_salle_de_bain_complet',
    libelle: 'Nettoyage complet des WC',
    room_id: 'wc_salle_de_bain',
    cadence: 'passage_A',
    duree_estimee_min: 10,
  },
  {
    id: 'sols_zone_jour',
    libelle: 'Sols de la zone jour',
    cadence: 'passage_A',
    checklist: ['Salle à manger', 'Salon', 'Cuisine', 'Couloir', 'Entrée 1', 'Entrée 2'],
    duree_estimee_min: 35,
  },
  {
    id: 'depoussierage_zone_jour',
    libelle: 'Dépoussiérage de la zone jour',
    cadence: 'passage_A',
    checklist: ['Meubles'],
    duree_estimee_min: 15,
  },
  {
    id: 'atelier_entretien',
    libelle: "Entretien de l'atelier",
    room_id: 'atelier',
    cadence: 'passage_A',
    checklist: ['Aspiration', 'Lavage du sol', 'Dépoussiérage'],
    instructions: "Pièce libérée pendant l'intervention.",
    duree_estimee_min: 15,
  },
  {
    id: 'bureau_entretien',
    libelle: 'Entretien du bureau',
    room_id: 'bureau',
    cadence: 'passage_A',
    checklist: ['Aspiration', 'Lavage du sol', 'Dépoussiérage'],
    instructions: "Pièce libérée pendant l'intervention.",
    duree_estimee_min: 10,
  },

  // --- Passage 2 (B) — chambres et salle de douche (SPEC §4.3) ---
  {
    id: 'salle_de_douche_complet',
    libelle: 'Nettoyage complet de la salle de douche',
    room_id: 'salle_de_douche',
    cadence: 'passage_B',
    checklist: ['Douche : parois et joints', 'Meuble vasque', 'Robinetterie', 'Miroir'],
    duree_estimee_min: 25,
  },
  {
    id: 'wc_salle_de_douche_complet',
    libelle: 'Nettoyage complet des WC',
    room_id: 'wc_salle_de_douche',
    cadence: 'passage_B',
    duree_estimee_min: 10,
  },
  {
    id: 'chambre_enfant_1_entretien',
    libelle: 'Entretien de la chambre',
    room_id: 'chambre_enfant_1',
    cadence: 'passage_B',
    checklist: ['Rangement', 'Dépoussiérage', 'Aspiration', 'Lavage du sol', 'Lit refait'],
    duree_estimee_min: 20,
  },
  {
    id: 'chambre_enfant_2_entretien',
    libelle: 'Entretien de la chambre',
    room_id: 'chambre_enfant_2',
    cadence: 'passage_B',
    checklist: ['Rangement', 'Dépoussiérage', 'Aspiration', 'Lavage du sol', 'Lit refait'],
    duree_estimee_min: 20,
  },
  {
    id: 'chambre_parents_entretien',
    libelle: 'Entretien de la chambre',
    room_id: 'chambre_parents',
    cadence: 'passage_B',
    checklist: ['Rangement léger', 'Dépoussiérage', 'Aspiration', 'Lavage du sol', 'Lit refait'],
    duree_estimee_min: 20,
  },
  {
    id: 'sols_zone_jour_rapide',
    libelle: "Sols de la zone jour — passage rapide d'entretien",
    cadence: 'passage_B',
    duree_estimee_min: 15,
  },

  // --- Rotation mensuelle (SPEC §4.4) ---
  {
    id: 'draps',
    libelle: 'Changement des draps',
    cadence: 'mensuelle',
    checklist: ['Chambre enfant 1', 'Chambre enfant 2', 'Chambre parents'],
    cible_rotative: CIBLE_DRAPS,
    // Choix validé (CHOIX_FOYER) : l'ensemble des lits, sur un passage B.
    passage_contraint: 'B',
    instructions: 'Linge de lit disponible dans le placard de chaque chambre, service libre.',
    duree_estimee_min: 30,
  },
  {
    id: 'vitres',
    libelle: 'Vitres',
    cadence: 'mensuelle',
    cible_rotative: { type: 'pieces_vitres' },
    instructions: 'Une pièce par mois, à tour de rôle.',
    duree_estimee_min: 30,
  },
  {
    id: 'contenants_poubelles',
    libelle: 'Nettoyage des contenants à poubelles',
    room_id: 'cuisine',
    cadence: 'mensuelle',
    duree_estimee_min: 15,
  },
  {
    id: 'aspiration_canape',
    libelle: 'Aspiration du canapé',
    room_id: 'salon',
    cadence: 'mensuelle',
    checklist: ['Assises', 'Dessous des coussins'],
    duree_estimee_min: 15,
  },

  // --- Rotation trimestrielle (SPEC §4.5) ---
  {
    id: 'four_micro_ondes',
    libelle: 'Intérieur du four ou du micro-ondes',
    room_id: 'cuisine',
    cadence: 'trimestrielle',
    // Les valeurs servent de cible ET de libellé affiché : ne pas les renommer
    // sans migration (l'historique fait foi pour le curseur d'alternance).
    cible_rotative: { type: 'liste', valeurs: ['Four', 'Micro-ondes'] },
    duree_estimee_min: 30,
  },
  {
    id: 'refrigerateur',
    libelle: 'Intérieur du réfrigérateur',
    room_id: 'cuisine',
    cadence: 'trimestrielle',
    duree_estimee_min: 30,
  },
  {
    id: 'plinthes_portes',
    libelle: 'Plinthes, portes, poignées et interrupteurs',
    cadence: 'trimestrielle',
    checklist: ['Plinthes', 'Traces sur les portes', 'Poignées', 'Interrupteurs'],
    duree_estimee_min: 30,
  },
  {
    id: 'lave_linge_entretien',
    libelle: 'Bac à lessive et joint de hublot du lave-linge',
    cadence: 'trimestrielle',
    duree_estimee_min: 15,
  },
]

export const TACHES_INITIALES: DefinitionTache[] = EBAUCHES_TACHES.map((e) => ({
  id: e.id,
  libelle: e.libelle,
  room_id: e.room_id ?? null,
  checklist: e.checklist ?? [],
  cadence: e.cadence,
  duree_estimee_min: e.duree_estimee_min ?? null,
  cible_rotative: e.cible_rotative ?? null,
  passage_contraint: e.passage_contraint ?? null,
  instructions: e.instructions ?? null,
  actif: true,
}))
