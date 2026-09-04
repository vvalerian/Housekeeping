/**
 * Schéma Drizzle (SQLite). Les colonnes reprennent les noms du domaine
 * (`@housekeeping/core`) pour que les lignes soient directement utilisables
 * par le moteur, sans couche de mapping. Les listes structurées (checklist,
 * périodes d'inactivité, cible rotative) sont stockées en JSON : volumes
 * minuscules, jamais interrogées en SQL.
 */
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type {
  AuteurMessage,
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

export const pieces = sqliteTable('pieces', {
  id: text('id').primaryKey(),
  nom: text('nom').notNull(),
  type: text('type').$type<TypePiece>().notNull(),
  surface_m2: real('surface_m2'),
  actif: integer('actif', { mode: 'boolean' }).notNull(),
  periodes_inactivite: text('periodes_inactivite', { mode: 'json' })
    .$type<PeriodeInactivite[]>()
    .notNull(),
  ordre_affichage: integer('ordre_affichage').notNull(),
  inclus_rotation_vitres: integer('inclus_rotation_vitres', { mode: 'boolean' }).notNull(),
})

export const taches = sqliteTable('taches', {
  id: text('id').primaryKey(),
  libelle: text('libelle').notNull(),
  room_id: text('room_id').references(() => pieces.id),
  checklist: text('checklist', { mode: 'json' }).$type<string[]>().notNull(),
  cadence: text('cadence')
    .$type<'chaque_passage' | 'passage_A' | 'passage_B' | 'mensuelle' | 'trimestrielle'>()
    .notNull(),
  duree_estimee_min: real('duree_estimee_min'),
  cible_rotative: text('cible_rotative', { mode: 'json' }).$type<CibleRotative | null>(),
  passage_contraint: text('passage_contraint').$type<'A' | 'B' | null>(),
  instructions: text('instructions'),
  actif: integer('actif', { mode: 'boolean' }).notNull(),
})

export const interventions = sqliteTable('interventions', {
  id: text('id').primaryKey(),
  date: text('date').notNull(), // AAAA-MM-JJ
  type: text('type').$type<TypeIntervention>().notNull(),
  statut: text('statut').$type<StatutIntervention>().notNull(),
  heure_debut: text('heure_debut'), // ISO 8601
  heure_fin: text('heure_fin'),
  note_intervenante: text('note_intervenante'),
  note_employeur: text('note_employeur'),
})

export const taskInstances = sqliteTable('task_instances', {
  id: text('id').primaryKey(),
  intervention_id: text('intervention_id')
    .notNull()
    .references(() => interventions.id, { onDelete: 'cascade' }),
  // Nullable : une demande ponctuelle ou un ajout spontané n'a pas de définition.
  task_definition_id: text('task_definition_id').references(() => taches.id),
  demande_ponctuelle_id: text('demande_ponctuelle_id').references(() => demandesPonctuelles.id),
  libelle: text('libelle').notNull(), // instantané à la planification
  room_id_effectif: text('room_id_effectif'),
  cible_resolue: text('cible_resolue'),
  statut: text('statut').$type<StatutInstance>().notNull(),
  motif_non_faite: text('motif_non_faite').$type<MotifNonFaite | null>(),
  commentaire: text('commentaire'),
  horodatage_validation: text('horodatage_validation'), // ISO 8601
  origine: text('origine').$type<OrigineInstance>().notNull(),
  reportee_depuis: text('reportee_depuis'), // AAAA-MM-JJ
})

export const demandesPonctuelles = sqliteTable('demandes_ponctuelles', {
  id: text('id').primaryKey(),
  texte: text('texte').notNull(),
  /** Intervention cible ; `null` = « prochaine ». */
  intervention_id: text('intervention_id').references(() => interventions.id),
  statut: text('statut').$type<StatutDemande>().notNull(),
  cree_le: text('cree_le').notNull(),
})

export const signalements = sqliteTable('signalements', {
  id: text('id').primaryKey(),
  type: text('type').$type<TypeSignalement>().notNull(),
  texte: text('texte').notNull(),
  statut: text('statut').$type<StatutSignalement>().notNull(),
  reponse_employeur: text('reponse_employeur'),
  intervention_id: text('intervention_id').references(() => interventions.id),
  cree_le: text('cree_le').notNull(),
})

export const produits = sqliteTable('produits', {
  id: text('id').primaryKey(),
  nom: text('nom').notNull(),
  niveau: text('niveau').$type<NiveauProduit>().notNull(),
  mis_a_jour_le: text('mis_a_jour_le').notNull(),
})

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  auteur: text('auteur').$type<AuteurMessage>().notNull(),
  texte: text('texte').notNull(),
  cree_le: text('cree_le').notNull(),
})

// --- Authentification (lot 3) ----------------------------------------------

export const comptesEmployeurs = sqliteTable('comptes_employeurs', {
  id: text('id').primaryKey(),
  identifiant: text('identifiant').notNull().unique(),
  /** Format `sel:hash` (scrypt), cf. `src/auth.ts`. */
  mot_de_passe_hash: text('mot_de_passe_hash').notNull(),
  cree_le: text('cree_le').notNull(),
})

export const sessionsAuth = sqliteTable('sessions_auth', {
  jeton: text('jeton').primaryKey(),
  type: text('type').$type<'employeur' | 'tablette'>().notNull(),
  compte_id: text('compte_id').references(() => comptesEmployeurs.id, { onDelete: 'cascade' }),
  cree_le: text('cree_le').notNull(),
  expire_le: text('expire_le').notNull(), // ISO 8601
})

/** Petits réglages persistés (ex. `pin_tablette_hash`), clé → valeur. */
export const parametres = sqliteTable('parametres', {
  cle: text('cle').primaryKey(),
  valeur: text('valeur').notNull(),
})
