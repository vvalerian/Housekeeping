/**
 * Formes des réponses de l'API du lot 1 (colonnes de `packages/server`),
 * typées avec les énumérations du domaine partagé.
 */
import type {
  MotifNonFaite,
  OrigineInstance,
  StatutInstance,
  StatutIntervention,
  TypeIntervention,
  TypeSignalement,
} from '@housekeeping/core'

export interface InterventionDto {
  id: string
  date: string
  type: TypeIntervention
  statut: StatutIntervention
  heure_debut: string | null
  heure_fin: string | null
  note_intervenante: string | null
  note_employeur: string | null
}

export interface InstanceDto {
  id: string
  intervention_id: string
  task_definition_id: string | null
  demande_ponctuelle_id: string | null
  libelle: string
  room_id_effectif: string | null
  cible_resolue: string | null
  statut: StatutInstance
  motif_non_faite: MotifNonFaite | null
  commentaire: string | null
  horodatage_validation: string | null
  origine: OrigineInstance
  reportee_depuis: string | null
}

export interface PlanDuJourDto {
  intervention: InterventionDto
  instances: InstanceDto[]
}

export interface PieceDto {
  id: string
  nom: string
  ordre_affichage: number
}

export interface DefinitionTacheDto {
  id: string
  libelle: string
  checklist: string[]
  instructions: string | null
}

export interface MessageDto {
  id: string
  auteur: 'intervenante' | 'employeur'
  texte: string
  cree_le: string
}

export type { MotifNonFaite, StatutInstance, TypeSignalement }
