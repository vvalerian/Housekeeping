/**
 * Colle entre la base et le moteur pur : charge la configuration et
 * l'historique, appelle `planifier()` et matérialise le résultat en
 * `task_instances`. C'est le SEUL endroit où le moteur est invoqué.
 */
import { randomUUID } from 'node:crypto'
import { and, eq, isNull, or } from 'drizzle-orm'
import {
  PARAMETRES_PLANIFICATION,
  planifier,
  type ConfigurationPlanification,
  type InterventionHistorique,
} from '@housekeeping/core'
import type { Db } from './db/client.js'
import * as schema from './db/schema.js'

type LigneIntervention = typeof schema.interventions.$inferSelect
type LigneInstance = typeof schema.taskInstances.$inferSelect

/**
 * Historique complet vu du moteur : toutes les interventions (sauf celle en
 * cours de planification) avec leurs instances. Les volumes sont minuscules
 * (deux interventions par semaine) : on charge tout et on filtre en mémoire.
 */
export function chargerHistorique(db: Db, saufInterventionId: string): InterventionHistorique[] {
  const interventions = db.select().from(schema.interventions).all()
  const instances = db.select().from(schema.taskInstances).all()
  const parIntervention = new Map<string, LigneInstance[]>()
  for (const instance of instances) {
    const liste = parIntervention.get(instance.intervention_id) ?? []
    liste.push(instance)
    parIntervention.set(instance.intervention_id, liste)
  }
  return interventions
    .filter((i) => i.id !== saufInterventionId)
    .map((i) => ({
      date: i.date,
      type: i.type,
      statut: i.statut,
      instances: (parIntervention.get(i.id) ?? []).map((inst) => ({
        task_definition_id: inst.task_definition_id,
        demande_ponctuelle_id: inst.demande_ponctuelle_id,
        libelle: inst.libelle,
        room_id_effectif: inst.room_id_effectif,
        cible_resolue: inst.cible_resolue,
        statut: inst.statut,
        motif_non_faite: inst.motif_non_faite,
        origine: inst.origine,
      })),
    }))
}

function demandesApplicables(db: Db, interventionId: string) {
  return db
    .select()
    .from(schema.demandesPonctuelles)
    .where(
      and(
        eq(schema.demandesPonctuelles.statut, 'en_attente'),
        or(
          isNull(schema.demandesPonctuelles.intervention_id),
          eq(schema.demandesPonctuelles.intervention_id, interventionId),
        ),
      ),
    )
    .all()
}

/**
 * Garantit que l'intervention a son plan :
 * - première consultation d'une intervention `planifiee`/`en_cours` sans
 *   instances → génération complète via `planifier()` ;
 * - ensuite, seules les demandes ponctuelles arrivées après la génération
 *   sont ajoutées (balayage idempotent).
 * Les interventions clôturées ou annulées ne sont jamais modifiées.
 */
export function assurerPlan(db: Db, intervention: LigneIntervention): LigneInstance[] {
  const chargerInstances = () =>
    db
      .select()
      .from(schema.taskInstances)
      .where(eq(schema.taskInstances.intervention_id, intervention.id))
      .all()

  if (intervention.statut === 'cloturee' || intervention.statut === 'annulee') {
    return chargerInstances()
  }

  const existantes = chargerInstances()
  if (existantes.length === 0) {
    const demandes = demandesApplicables(db, intervention.id)
    const configuration: ConfigurationPlanification = {
      pieces: db.select().from(schema.pieces).all(),
      taches: db.select().from(schema.taches).all(),
      parametres: PARAMETRES_PLANIFICATION,
      demandes_en_attente: demandes.map((d) => ({ id: d.id, texte: d.texte })),
    }
    const plan = planifier(
      intervention.date,
      intervention.type,
      chargerHistorique(db, intervention.id),
      configuration,
    )
    if (plan.length > 0) {
      db.insert(schema.taskInstances)
        .values(
          plan.map((tache) => ({
            id: randomUUID(),
            intervention_id: intervention.id,
            task_definition_id: tache.task_definition_id,
            demande_ponctuelle_id: tache.demande_ponctuelle_id,
            libelle: tache.libelle,
            room_id_effectif: tache.room_id_effectif,
            cible_resolue: tache.cible_resolue,
            statut: 'a_faire' as const,
            motif_non_faite: null,
            commentaire: null,
            horodatage_validation: null,
            origine: tache.origine,
            reportee_depuis: tache.reportee_depuis,
          })),
        )
        .run()
    }
    for (const tache of plan) {
      if (tache.demande_ponctuelle_id !== null) {
        db.update(schema.demandesPonctuelles)
          .set({ statut: 'injectee' })
          .where(eq(schema.demandesPonctuelles.id, tache.demande_ponctuelle_id))
          .run()
      }
    }
  }

  // Balayage : demandes applicables arrivées après la génération du plan.
  for (const demande of demandesApplicables(db, intervention.id)) {
    db.insert(schema.taskInstances)
      .values({
        id: randomUUID(),
        intervention_id: intervention.id,
        task_definition_id: null,
        demande_ponctuelle_id: demande.id,
        libelle: demande.texte,
        room_id_effectif: null,
        cible_resolue: null,
        statut: 'a_faire',
        motif_non_faite: null,
        commentaire: null,
        horodatage_validation: null,
        origine: 'ponctuelle',
        reportee_depuis: null,
      })
      .run()
    db.update(schema.demandesPonctuelles)
      .set({ statut: 'injectee' })
      .where(eq(schema.demandesPonctuelles.id, demande.id))
      .run()
  }

  return chargerInstances()
}
