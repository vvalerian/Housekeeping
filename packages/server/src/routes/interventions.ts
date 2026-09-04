/**
 * Calendrier, interventions, plan du jour et validation des instances.
 */
import { randomUUID } from 'node:crypto'
import { and, eq, gte, lte } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  CHOIX_FOYER,
  DateIsoSchema,
  MotifNonFaiteSchema,
  PARAMETRES_PLANIFICATION,
  StatutInstanceSchema,
  dateDerniereExecution,
  derniereCibleTraitee,
  genererCalendrier,
  joursEntre,
  TypeInterventionSchema,
} from '@housekeeping/core'
import type { Db } from '../db/client.js'
import * as schema from '../db/schema.js'
import { aujourdHui, lireCorps, maintenant } from '../http.js'
import { assurerPlan, chargerHistorique } from '../planification.js'

const GenerationCalendrierSchema = z
  .object({
    depuis: DateIsoSchema,
    jusqua: DateIsoSchema,
  })
  .refine((v) => v.depuis <= v.jusqua, { message: 'depuis doit précéder jusqua' })

const CreationInterventionSchema = z.object({
  date: DateIsoSchema,
  type: TypeInterventionSchema,
})

const ClotureSchema = z.object({
  note_intervenante: z.string().nullable().optional(),
})

const ModificationInterventionSchema = z.object({
  date: DateIsoSchema.optional(),
  note_employeur: z.string().nullable().optional(),
})

const ValidationInstanceSchema = z.object({
  statut: StatutInstanceSchema,
  motif_non_faite: MotifNonFaiteSchema.nullable().optional(),
  commentaire: z.string().nullable().optional(),
})

const AjoutSpontaneSchema = z.object({
  libelle: z.string().min(1),
  room_id: z.string().nullable().optional(),
})

export function routesInterventions(db: Db): Hono {
  const routes = new Hono()

  const chercherIntervention = (id: string) =>
    db.select().from(schema.interventions).where(eq(schema.interventions.id, id)).get()

  // --- Calendrier ---------------------------------------------------------

  routes.post('/calendrier/generer', async (c) => {
    const corps = await lireCorps(c, GenerationCalendrierSchema)
    if (corps instanceof Response) return corps
    const existantes = db.select().from(schema.interventions).all()
    const proposees = genererCalendrier(corps.depuis, corps.jusqua, existantes, {
      jours_intervention: CHOIX_FOYER.jours_intervention,
      premier_type_passage: CHOIX_FOYER.premier_type_passage,
    })
    const creees = proposees.map((p) => ({
      id: randomUUID(),
      date: p.date,
      type: p.type,
      statut: 'planifiee' as const,
      heure_debut: null,
      heure_fin: null,
      note_intervenante: null,
      note_employeur: null,
    }))
    if (creees.length > 0) db.insert(schema.interventions).values(creees).run()
    return c.json(creees, 201)
  })

  // --- Interventions ------------------------------------------------------

  routes.get('/interventions', (c) => {
    const du = c.req.query('du')
    const au = c.req.query('au')
    const conditions = []
    if (du !== undefined) conditions.push(gte(schema.interventions.date, du))
    if (au !== undefined) conditions.push(lte(schema.interventions.date, au))
    const lignes = db
      .select()
      .from(schema.interventions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(schema.interventions.date)
      .all()
    return c.json(lignes)
  })

  // L'écran d'accueil de la tablette : l'intervention du jour et son plan,
  // généré à la première consultation.
  routes.get('/interventions/du-jour', (c) => {
    const date = c.req.query('date') ?? aujourdHui()
    const duJour = db
      .select()
      .from(schema.interventions)
      .where(eq(schema.interventions.date, date))
      .all()
      .filter((i) => i.statut !== 'annulee')
    // Priorité à celle qui est en cours, puis à celle qui reste à faire.
    const priorite = { en_cours: 0, planifiee: 1, cloturee: 2, annulee: 3 } as const
    const intervention = duJour.sort((a, b) => priorite[a.statut] - priorite[b.statut])[0]
    if (intervention === undefined) {
      return c.json({ erreur: `Aucune intervention prévue le ${date}` }, 404)
    }
    return c.json({ intervention, instances: assurerPlan(db, intervention) })
  })

  // Vue « dernière exécution » des tâches tournantes (SPEC §7) : répond à
  // « ça fait combien de temps qu'on n'a pas fait le frigo ? ».
  routes.get('/rotations/etat', (c) => {
    const date = c.req.query('date') ?? aujourdHui()
    const historique = chargerHistorique(db, '')
      .filter((i) => i.date <= date)
      .sort((a, b) => a.date.localeCompare(b.date))
    const rotatives = db
      .select()
      .from(schema.taches)
      .all()
      .filter((t) => t.actif && (t.cadence === 'mensuelle' || t.cadence === 'trimestrielle'))
    return c.json(
      rotatives.map((tache) => {
        const periode =
          tache.cadence === 'mensuelle'
            ? PARAMETRES_PLANIFICATION.periode_mensuelle_jours
            : PARAMETRES_PLANIFICATION.periode_trimestrielle_jours
        const derniere = dateDerniereExecution(tache.id, historique)
        const jours = derniere === null ? null : joursEntre(derniere, date)
        return {
          task_definition_id: tache.id,
          libelle: tache.libelle,
          cadence: tache.cadence,
          periode_jours: periode,
          derniere_execution: derniere,
          derniere_cible: derniereCibleTraitee(tache.id, historique),
          jours_depuis: jours,
          ratio_retard: jours === null ? null : Math.round((jours / periode) * 100) / 100,
          jamais_executee: derniere === null,
        }
      }),
    )
  })

  routes.get('/interventions/:id', (c) => {
    const intervention = chercherIntervention(c.req.param('id'))
    if (intervention === undefined) return c.json({ erreur: 'Intervention inconnue' }, 404)
    return c.json({ intervention, instances: assurerPlan(db, intervention) })
  })

  routes.post('/interventions', async (c) => {
    const corps = await lireCorps(c, CreationInterventionSchema)
    if (corps instanceof Response) return corps
    const intervention = {
      id: randomUUID(),
      date: corps.date,
      type: corps.type,
      statut: 'planifiee' as const,
      heure_debut: null,
      heure_fin: null,
      note_intervenante: null,
      note_employeur: null,
    }
    db.insert(schema.interventions).values(intervention).run()
    return c.json(intervention, 201)
  })

  routes.post('/interventions/:id/demarrer', (c) => {
    const intervention = chercherIntervention(c.req.param('id'))
    if (intervention === undefined) return c.json({ erreur: 'Intervention inconnue' }, 404)
    if (intervention.statut === 'cloturee' || intervention.statut === 'annulee') {
      return c.json({ erreur: `Intervention ${intervention.statut}` }, 409)
    }
    assurerPlan(db, intervention)
    if (intervention.statut === 'planifiee') {
      db.update(schema.interventions)
        .set({ statut: 'en_cours', heure_debut: intervention.heure_debut ?? maintenant() })
        .where(eq(schema.interventions.id, intervention.id))
        .run()
    }
    const rechargee = chercherIntervention(intervention.id)!
    return c.json({ intervention: rechargee, instances: assurerPlan(db, rechargee) })
  })

  routes.post('/interventions/:id/cloturer', async (c) => {
    const corps = await lireCorps(c, ClotureSchema)
    if (corps instanceof Response) return corps
    const intervention = chercherIntervention(c.req.param('id'))
    if (intervention === undefined) return c.json({ erreur: 'Intervention inconnue' }, 404)
    if (intervention.statut === 'cloturee' || intervention.statut === 'annulee') {
      return c.json({ erreur: `Intervention déjà ${intervention.statut}` }, 409)
    }
    // Aucun blocage si des tâches restent non cochées (SPEC §6) : elles passent
    // à non_faite sans motif — « non renseigné », donc pas repêchées.
    db.update(schema.taskInstances)
      .set({ statut: 'non_faite' })
      .where(
        and(
          eq(schema.taskInstances.intervention_id, intervention.id),
          eq(schema.taskInstances.statut, 'a_faire'),
        ),
      )
      .run()
    db.update(schema.interventions)
      .set({
        statut: 'cloturee',
        heure_fin: maintenant(),
        note_intervenante: corps.note_intervenante ?? intervention.note_intervenante,
      })
      .where(eq(schema.interventions.id, intervention.id))
      .run()
    const rechargee = chercherIntervention(intervention.id)!
    return c.json({ intervention: rechargee, instances: assurerPlan(db, rechargee) })
  })

  routes.post('/interventions/:id/annuler', (c) => {
    const intervention = chercherIntervention(c.req.param('id'))
    if (intervention === undefined) return c.json({ erreur: 'Intervention inconnue' }, 404)
    if (intervention.statut === 'cloturee') {
      return c.json({ erreur: 'Impossible d’annuler une intervention clôturée' }, 409)
    }
    db.update(schema.interventions)
      .set({ statut: 'annulee' })
      .where(eq(schema.interventions.id, intervention.id))
      .run()
    return c.json(chercherIntervention(intervention.id))
  })

  routes.patch('/interventions/:id', async (c) => {
    const corps = await lireCorps(c, ModificationInterventionSchema)
    if (corps instanceof Response) return corps
    const intervention = chercherIntervention(c.req.param('id'))
    if (intervention === undefined) return c.json({ erreur: 'Intervention inconnue' }, 404)
    if (corps.date !== undefined && intervention.statut !== 'planifiee') {
      return c.json({ erreur: 'Seule une intervention planifiée peut être déplacée' }, 409)
    }
    db.update(schema.interventions)
      .set(corps)
      .where(eq(schema.interventions.id, intervention.id))
      .run()
    return c.json(chercherIntervention(intervention.id))
  })

  // --- Instances ----------------------------------------------------------

  routes.patch('/instances/:id', async (c) => {
    const corps = await lireCorps(c, ValidationInstanceSchema)
    if (corps instanceof Response) return corps
    const instance = db
      .select()
      .from(schema.taskInstances)
      .where(eq(schema.taskInstances.id, c.req.param('id')))
      .get()
    if (instance === undefined) return c.json({ erreur: 'Instance inconnue' }, 404)
    const misesAJour = {
      statut: corps.statut,
      // Le motif n'a de sens que pour une tâche non faite ou partielle.
      motif_non_faite:
        corps.statut === 'non_faite' || corps.statut === 'partielle'
          ? (corps.motif_non_faite ?? instance.motif_non_faite)
          : null,
      commentaire: corps.commentaire === undefined ? instance.commentaire : corps.commentaire,
      horodatage_validation: corps.statut === 'a_faire' ? null : maintenant(),
    }
    db.update(schema.taskInstances)
      .set(misesAJour)
      .where(eq(schema.taskInstances.id, instance.id))
      .run()
    return c.json(
      db.select().from(schema.taskInstances).where(eq(schema.taskInstances.id, instance.id)).get(),
    )
  })

  routes.post('/interventions/:id/instances', async (c) => {
    const corps = await lireCorps(c, AjoutSpontaneSchema)
    if (corps instanceof Response) return corps
    const intervention = chercherIntervention(c.req.param('id'))
    if (intervention === undefined) return c.json({ erreur: 'Intervention inconnue' }, 404)
    if (intervention.statut === 'cloturee' || intervention.statut === 'annulee') {
      return c.json({ erreur: `Intervention ${intervention.statut}` }, 409)
    }
    if (
      corps.room_id != null &&
      db.select().from(schema.pieces).where(eq(schema.pieces.id, corps.room_id)).get() === undefined
    ) {
      return c.json({ erreur: `Pièce inconnue : ${corps.room_id}` }, 404)
    }
    const instance = {
      id: randomUUID(),
      intervention_id: intervention.id,
      task_definition_id: null,
      demande_ponctuelle_id: null,
      libelle: corps.libelle,
      room_id_effectif: corps.room_id ?? null,
      cible_resolue: null,
      statut: 'a_faire' as const,
      motif_non_faite: null,
      commentaire: null,
      horodatage_validation: null,
      origine: 'ajout_spontane' as const,
      reportee_depuis: null,
    }
    db.insert(schema.taskInstances).values(instance).run()
    return c.json(instance, 201)
  })

  return routes
}
