/**
 * Demandes ponctuelles, signalements, consommables et fil de messages
 * (SPEC §3.5 et §7).
 */
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  AuteurMessageSchema,
  NiveauProduitSchema,
  StatutSignalementSchema,
  TypeSignalementSchema,
} from '@housekeeping/core'
import type { Db } from '../db/client.js'
import * as schema from '../db/schema.js'
import { lireCorps, maintenant } from '../http.js'

const CreationDemandeSchema = z.object({
  texte: z.string().min(1),
  /** Intervention cible ; absent ou nul = « prochaine ». */
  intervention_id: z.string().nullable().optional(),
})

const ModificationDemandeSchema = z.object({
  texte: z.string().min(1).optional(),
  statut: z.enum(['en_attente', 'annulee']).optional(),
})

const CreationSignalementSchema = z.object({
  type: TypeSignalementSchema,
  texte: z.string().min(1),
  intervention_id: z.string().nullable().optional(),
})

const ModificationSignalementSchema = z.object({
  statut: StatutSignalementSchema.optional(),
  reponse_employeur: z.string().nullable().optional(),
})

const CreationProduitSchema = z.object({
  nom: z.string().min(1),
  niveau: NiveauProduitSchema.optional(),
})

const ModificationProduitSchema = z.object({
  nom: z.string().min(1).optional(),
  niveau: NiveauProduitSchema.optional(),
})

const CreationMessageSchema = z.object({
  auteur: AuteurMessageSchema,
  texte: z.string().min(1),
})

export function routesEchanges(db: Db): Hono {
  const routes = new Hono()

  // --- Demandes ponctuelles ----------------------------------------------

  routes.get('/demandes', (c) => {
    const statut = c.req.query('statut')
    const lignes = db.select().from(schema.demandesPonctuelles).all()
    return c.json(statut === undefined ? lignes : lignes.filter((d) => d.statut === statut))
  })

  routes.post('/demandes', async (c) => {
    const corps = await lireCorps(c, CreationDemandeSchema)
    if (corps instanceof Response) return corps
    if (corps.intervention_id != null) {
      const intervention = db
        .select()
        .from(schema.interventions)
        .where(eq(schema.interventions.id, corps.intervention_id))
        .get()
      if (intervention === undefined) return c.json({ erreur: 'Intervention inconnue' }, 404)
      if (intervention.statut === 'cloturee' || intervention.statut === 'annulee') {
        return c.json({ erreur: `Intervention ${intervention.statut}` }, 409)
      }
    }
    const demande = {
      id: randomUUID(),
      texte: corps.texte,
      intervention_id: corps.intervention_id ?? null,
      statut: 'en_attente' as const,
      cree_le: maintenant(),
    }
    db.insert(schema.demandesPonctuelles).values(demande).run()
    return c.json(demande, 201)
  })

  routes.patch('/demandes/:id', async (c) => {
    const corps = await lireCorps(c, ModificationDemandeSchema)
    if (corps instanceof Response) return corps
    const demande = db
      .select()
      .from(schema.demandesPonctuelles)
      .where(eq(schema.demandesPonctuelles.id, c.req.param('id')))
      .get()
    if (demande === undefined) return c.json({ erreur: 'Demande inconnue' }, 404)
    if (demande.statut === 'injectee') {
      return c.json({ erreur: 'Demande déjà injectée dans un plan' }, 409)
    }
    if (Object.keys(corps).length > 0) {
      db.update(schema.demandesPonctuelles)
        .set(corps)
        .where(eq(schema.demandesPonctuelles.id, demande.id))
        .run()
    }
    return c.json(
      db
        .select()
        .from(schema.demandesPonctuelles)
        .where(eq(schema.demandesPonctuelles.id, demande.id))
        .get(),
    )
  })

  // --- Signalements -------------------------------------------------------

  routes.get('/signalements', (c) => {
    const statut = c.req.query('statut')
    const lignes = db.select().from(schema.signalements).all()
    return c.json(statut === undefined ? lignes : lignes.filter((s) => s.statut === statut))
  })

  routes.post('/signalements', async (c) => {
    const corps = await lireCorps(c, CreationSignalementSchema)
    if (corps instanceof Response) return corps
    const signalement = {
      id: randomUUID(),
      type: corps.type,
      texte: corps.texte,
      statut: 'ouvert' as const,
      reponse_employeur: null,
      intervention_id: corps.intervention_id ?? null,
      cree_le: maintenant(),
    }
    db.insert(schema.signalements).values(signalement).run()
    return c.json(signalement, 201)
  })

  routes.patch('/signalements/:id', async (c) => {
    const corps = await lireCorps(c, ModificationSignalementSchema)
    if (corps instanceof Response) return corps
    const signalement = db
      .select()
      .from(schema.signalements)
      .where(eq(schema.signalements.id, c.req.param('id')))
      .get()
    if (signalement === undefined) return c.json({ erreur: 'Signalement inconnu' }, 404)
    if (Object.keys(corps).length > 0) {
      db.update(schema.signalements)
        .set(corps)
        .where(eq(schema.signalements.id, signalement.id))
        .run()
    }
    return c.json(
      db.select().from(schema.signalements).where(eq(schema.signalements.id, signalement.id)).get(),
    )
  })

  // --- Produits (consommables) --------------------------------------------

  routes.get('/produits', (c) =>
    c.json(db.select().from(schema.produits).orderBy(schema.produits.nom).all()),
  )

  routes.post('/produits', async (c) => {
    const corps = await lireCorps(c, CreationProduitSchema)
    if (corps instanceof Response) return corps
    const produit = {
      id: randomUUID(),
      nom: corps.nom,
      niveau: corps.niveau ?? ('ok' as const),
      mis_a_jour_le: maintenant(),
    }
    db.insert(schema.produits).values(produit).run()
    return c.json(produit, 201)
  })

  routes.patch('/produits/:id', async (c) => {
    const corps = await lireCorps(c, ModificationProduitSchema)
    if (corps instanceof Response) return corps
    const produit = db
      .select()
      .from(schema.produits)
      .where(eq(schema.produits.id, c.req.param('id')))
      .get()
    if (produit === undefined) return c.json({ erreur: 'Produit inconnu' }, 404)
    if (Object.keys(corps).length > 0) {
      db.update(schema.produits)
        .set({ ...corps, mis_a_jour_le: maintenant() })
        .where(eq(schema.produits.id, produit.id))
        .run()
    }
    return c.json(db.select().from(schema.produits).where(eq(schema.produits.id, produit.id)).get())
  })

  // --- Messages -----------------------------------------------------------

  routes.get('/messages', (c) =>
    c.json(db.select().from(schema.messages).orderBy(schema.messages.cree_le).all()),
  )

  routes.post('/messages', async (c) => {
    const corps = await lireCorps(c, CreationMessageSchema)
    if (corps instanceof Response) return corps
    const message = {
      id: randomUUID(),
      auteur: corps.auteur,
      texte: corps.texte,
      cree_le: maintenant(),
    }
    db.insert(schema.messages).values(message).run()
    return c.json(message, 201)
  })

  return routes
}
