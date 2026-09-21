/** Formes des réponses de l'API, typées avec les énumérations du domaine. */
import type {
  Cadence,
  CibleRotative,
  MotifNonFaite,
  NiveauProduit,
  OrigineInstance,
  PeriodeInactivite,
  StatutDemande,
  StatutInstance,
  StatutIntervention,
  StatutSignalement,
  TypeIntervention,
  TypePiece,
  TypeSignalement,
} from '@housekeeping/core'

export interface EtatAuthDto {
  initialisation_requise: boolean
  acteur: 'employeur' | 'tablette' | null
  pin: 'non_configure' | 'requis' | 'desactive'
}

export interface PieceDto {
  id: string
  nom: string
  nom_pt: string | null
  type: TypePiece
  surface_m2: number | null
  actif: boolean
  periodes_inactivite: PeriodeInactivite[]
  ordre_affichage: number
  inclus_rotation_vitres: boolean
}

export interface TacheDto {
  id: string
  libelle: string
  libelle_pt: string | null
  room_id: string | null
  checklist: string[]
  checklist_pt: string[] | null
  cadence: Cadence
  duree_estimee_min: number | null
  cible_rotative: CibleRotative | null
  passage_contraint: 'A' | 'B' | null
  instructions: string | null
  instructions_pt: string | null
  actif: boolean
}

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
  task_definition_id: string | null
  libelle: string
  room_id_effectif: string | null
  cible_resolue: string | null
  statut: StatutInstance
  motif_non_faite: MotifNonFaite | null
  commentaire: string | null
  origine: OrigineInstance
  reportee_depuis: string | null
}

export interface DetailInterventionDto {
  intervention: InterventionDto
  instances: InstanceDto[]
}

export interface RotationDto {
  task_definition_id: string
  libelle: string
  cadence: Cadence
  periode_jours: number
  derniere_execution: string | null
  derniere_cible: string | null
  jours_depuis: number | null
  ratio_retard: number | null
  jamais_executee: boolean
}

export interface DemandeDto {
  id: string
  texte: string
  intervention_id: string | null
  statut: StatutDemande
  cree_le: string
}

export interface SignalementDto {
  id: string
  type: TypeSignalement
  texte: string
  statut: StatutSignalement
  reponse_employeur: string | null
  intervention_id: string | null
  cree_le: string
}

export interface ProduitDto {
  id: string
  nom: string
  niveau: NiveauProduit
  mis_a_jour_le: string
}

export interface MessageDto {
  id: string
  auteur: 'intervenante' | 'employeur'
  texte: string
  cree_le: string
}

export interface CompteDto {
  id: string
  identifiant: string
  cree_le: string
}
