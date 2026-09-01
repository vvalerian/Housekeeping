/**
 * Modèle de données du domaine (SPEC.md §3), sous forme de schémas Zod partagés
 * entre le serveur et les futurs clients. Les extensions par rapport à la spec
 * sont signalées en commentaire et justifiées dans DECISIONS.md.
 */
import { z } from 'zod'
import type { DateISO } from './dates.js'

export const DateIsoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// ---------------------------------------------------------------------------
// Pièce (SPEC §3.1)
// ---------------------------------------------------------------------------

export const TypePieceSchema = z.enum([
  'cuisine',
  'salon',
  'chambre',
  'bureau',
  'sanitaire',
  'circulation',
])
export type TypePiece = z.infer<typeof TypePieceSchema>

export const PeriodeInactiviteSchema = z.object({
  debut: DateIsoSchema,
  /** `null` = jusqu'à nouvel ordre. */
  fin: DateIsoSchema.nullable(),
  motif: z.string(),
})
export type PeriodeInactivite = z.infer<typeof PeriodeInactiviteSchema>

export const PieceSchema = z.object({
  id: z.string().min(1),
  nom: z.string().min(1),
  type: TypePieceSchema,
  surface_m2: z.number().positive().nullable(),
  actif: z.boolean(),
  periodes_inactivite: z.array(PeriodeInactiviteSchema),
  ordre_affichage: z.number().int(),
  inclus_rotation_vitres: z.boolean(),
})
export type Piece = z.infer<typeof PieceSchema>

/**
 * Une pièce est active à une date si son drapeau `actif` est vrai et qu'aucune
 * période d'inactivité ne couvre la date. Bornes incluses ; `fin` nulle = période
 * ouverte (la réactivation est effective le lendemain de `fin`).
 */
export function estPieceActiveALaDate(piece: Piece, date: DateISO): boolean {
  if (!piece.actif) return false
  return !piece.periodes_inactivite.some(
    (p) => p.debut <= date && (p.fin === null || date <= p.fin),
  )
}

// ---------------------------------------------------------------------------
// Définition de tâche (SPEC §3.2)
// ---------------------------------------------------------------------------

export const CadenceSchema = z.enum([
  'chaque_passage',
  'passage_A',
  'passage_B',
  'mensuelle',
  'trimestrielle',
])
export type Cadence = z.infer<typeof CadenceSchema>

/**
 * Mécanisme de sous-rotation (SPEC §5 étape 3) :
 * - `pieces_vitres` : curseur circulaire sur les pièces marquées `inclus_rotation_vitres` ;
 * - `pieces`        : curseur circulaire sur une liste explicite de pièces (option draps) ;
 * - `liste`         : curseur circulaire sur des valeurs libres (four / micro-ondes).
 */
export const CibleRotativeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pieces_vitres') }),
  z.object({ type: z.literal('pieces'), piece_ids: z.array(z.string()).min(1) }),
  z.object({ type: z.literal('liste'), valeurs: z.array(z.string()).min(2) }),
])
export type CibleRotative = z.infer<typeof CibleRotativeSchema>

export const DefinitionTacheSchema = z.object({
  id: z.string().min(1),
  libelle: z.string().min(1),
  /** `null` pour les tâches transverses (linge, poubelles…). */
  room_id: z.string().nullable(),
  /** Sous-points affichés en détail, non cochables individuellement. */
  checklist: z.array(z.string()),
  cadence: CadenceSchema,
  /** Indicative, jamais affichée à l'intervenante. */
  duree_estimee_min: z.number().positive().nullable(),
  cible_rotative: CibleRotativeSchema.nullable(),
  /**
   * Extension à la spec (DECISIONS.md) : restreint une tâche tournante à un type
   * de passage — les draps se planifient « sur un passage 2 » (SPEC §4.4).
   */
  passage_contraint: z.enum(['A', 'B']).nullable(),
  instructions: z.string().nullable(),
  actif: z.boolean(),
})
export type DefinitionTache = z.infer<typeof DefinitionTacheSchema>

// ---------------------------------------------------------------------------
// Intervention (SPEC §3.3)
// ---------------------------------------------------------------------------

export const TypeInterventionSchema = z.enum(['A', 'B', 'exceptionnelle'])
export type TypeIntervention = z.infer<typeof TypeInterventionSchema>

export const StatutInterventionSchema = z.enum(['planifiee', 'en_cours', 'cloturee', 'annulee'])
export type StatutIntervention = z.infer<typeof StatutInterventionSchema>

// ---------------------------------------------------------------------------
// Instance de tâche (SPEC §3.4)
// ---------------------------------------------------------------------------

export const StatutInstanceSchema = z.enum(['a_faire', 'faite', 'partielle', 'non_faite'])
export type StatutInstance = z.infer<typeof StatutInstanceSchema>

export const MotifNonFaiteSchema = z.enum([
  'manque_de_temps',
  'piece_inaccessible',
  'produit_manquant',
  'non_necessaire',
  'autre',
])
export type MotifNonFaite = z.infer<typeof MotifNonFaiteSchema>

export const OrigineInstanceSchema = z.enum(['plan', 'rotation', 'ponctuelle', 'ajout_spontane'])
export type OrigineInstance = z.infer<typeof OrigineInstanceSchema>

// ---------------------------------------------------------------------------
// Autres entités (SPEC §3.5)
// ---------------------------------------------------------------------------

export const TypeSignalementSchema = z.enum([
  'casse',
  'produit_a_racheter',
  'probleme_technique',
  'autre',
])
export type TypeSignalement = z.infer<typeof TypeSignalementSchema>

export const StatutSignalementSchema = z.enum(['ouvert', 'traite'])
export type StatutSignalement = z.infer<typeof StatutSignalementSchema>

export const StatutDemandeSchema = z.enum(['en_attente', 'injectee', 'annulee'])
export type StatutDemande = z.infer<typeof StatutDemandeSchema>

export const NiveauProduitSchema = z.enum(['ok', 'bas', 'epuise'])
export type NiveauProduit = z.infer<typeof NiveauProduitSchema>

export const AuteurMessageSchema = z.enum(['intervenante', 'employeur'])
export type AuteurMessage = z.infer<typeof AuteurMessageSchema>

// ---------------------------------------------------------------------------
// Entrées / sorties du moteur de planification (SPEC §5)
// ---------------------------------------------------------------------------

/** Vue minimale d'une instance passée, suffisante pour le moteur. */
export interface InstanceHistorique {
  task_definition_id: string | null
  demande_ponctuelle_id: string | null
  libelle: string
  room_id_effectif: string | null
  cible_resolue: string | null
  statut: StatutInstance
  motif_non_faite: MotifNonFaite | null
  origine: OrigineInstance
}

export interface InterventionHistorique {
  date: DateISO
  type: TypeIntervention
  statut: StatutIntervention
  instances: InstanceHistorique[]
}

export interface DemandeEnAttente {
  id: string
  texte: string
}

/** Réglages du moteur — valeurs de production dans `configuration.ts`. */
export interface ParametresPlanification {
  seuil_eligibilite: number
  max_rotatives_par_intervention: number
  seuil_arriere: number
  periode_mensuelle_jours: number
  periode_trimestrielle_jours: number
}

export interface ConfigurationPlanification {
  pieces: Piece[]
  taches: DefinitionTache[]
  parametres: ParametresPlanification
  /**
   * Demandes ponctuelles applicables à l'intervention planifiée (rattachées à
   * elle ou marquées « prochaine ») — le filtrage est fait par l'appelant.
   */
  demandes_en_attente: DemandeEnAttente[]
}

/**
 * Sortie du moteur : une instance de tâche encore détachée de la base (pas
 * d'`id` ni d'`intervention_id`, statut implicite `a_faire`). Le serveur la
 * matérialise en `TaskInstance`.
 */
export interface TachePlanifiee {
  task_definition_id: string | null
  demande_ponctuelle_id: string | null
  /** Instantané du libellé au moment de la planification. */
  libelle: string
  room_id_effectif: string | null
  cible_resolue: string | null
  origine: OrigineInstance
  /** Date de l'intervention d'origine si la tâche est repêchée (SPEC §5 étape 5). */
  reportee_depuis: DateISO | null
}
