/**
 * Configuration des pièces et des tâches (SPEC §7) : tout ce que le seed a
 * chargé se modifie ici, sans redéploiement.
 */
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  CadenceSchema,
  CibleRotativeSchema,
  DateIsoSchema,
  DefinitionTacheSchema,
  PieceSchema,
  TypePieceSchema,
} from '@housekeeping/core'
import { exigerEmployeur } from '../auth.js'
import type { Db } from '../db/client.js'
import * as schema from '../db/schema.js'
import { aujourdHui, lireCorps } from '../http.js'

const CreationPieceSchema = z.object({
  nom: z.string().min(1),
  type: TypePieceSchema,
  surface_m2: z.number().positive().nullable().optional(),
  ordre_affichage: z.number().int().optional(),
  inclus_rotation_vitres: z.boolean().optional(),
})

const ModificationPieceSchema = PieceSchema.omit({ id: true }).partial()

const ModeTravauxSchema = z.object({
  piece_ids: z.array(z.string()).min(1),
  debut: DateIsoSchema,
  fin: DateIsoSchema.nullable().optional(),
  motif: z.string().optional(),
})

const ReactivationSchema = z.object({
  /** Dernier jour d'inactivité ; par défaut, la veille du jour courant. */
  fin: DateIsoSchema.optional(),
})

const CreationTacheSchema = z.object({
  libelle: z.string().min(1),
  cadence: CadenceSchema,
  room_id: z.string().nullable().optional(),
  checklist: z.array(z.string()).optional(),
  duree_estimee_min: z.number().positive().nullable().optional(),
  cible_rotative: CibleRotativeSchema.nullable().optional(),
  passage_contraint: z.enum(['A', 'B']).nullable().optional(),
  instructions: z.string().nullable().optional(),
})

const ModificationTacheSchema = DefinitionTacheSchema.omit({ id: true }).partial()

export function routesConfiguration(db: Db): Hono {
  const routes = new Hono()

  // --- Pièces -------------------------------------------------------------

  routes.get('/pieces', (c) =>
    c.json(db.select().from(schema.pieces).orderBy(schema.pieces.ordre_affichage).all()),
  )

  routes.post('/pieces', exigerEmployeur, async (c) => {
    const corps = await lireCorps(c, CreationPieceSchema)
    if (corps instanceof Response) return corps
    const ordreMax = db
      .select()
      .from(schema.pieces)
      .all()
      .reduce((max, piece) => Math.max(max, piece.ordre_affichage), 0)
    const piece = {
      id: randomUUID(),
      nom: corps.nom,
      type: corps.type,
      surface_m2: corps.surface_m2 ?? null,
      actif: true,
      periodes_inactivite: [],
      ordre_affichage: corps.ordre_affichage ?? ordreMax + 10,
      inclus_rotation_vitres: corps.inclus_rotation_vitres ?? false,
    }
    db.insert(schema.pieces).values(piece).run()
    return c.json(piece, 201)
  })

  // Mode « travaux » d'un clic (SPEC §7) : une période d'inactivité posée sur
  // plusieurs pièces à la fois, avec réactivation automatique si `fin` est
  // fournie (les périodes sont évaluées à la date, rien à faire à l'échéance).
  routes.post('/pieces/mode-travaux', exigerEmployeur, async (c) => {
    const corps = await lireCorps(c, ModeTravauxSchema)
    if (corps instanceof Response) return corps
    const cibles = corps.piece_ids.map((id) =>
      db.select().from(schema.pieces).where(eq(schema.pieces.id, id)).get(),
    )
    const inconnues = corps.piece_ids.filter((_, i) => cibles[i] === undefined)
    if (inconnues.length > 0) {
      return c.json({ erreur: `Pièces inconnues : ${inconnues.join(', ')}` }, 404)
    }
    const periode = {
      debut: corps.debut,
      fin: corps.fin ?? null,
      motif: corps.motif ?? 'Travaux',
    }
    for (const piece of cibles) {
      db.update(schema.pieces)
        .set({ periodes_inactivite: [...piece!.periodes_inactivite, periode] })
        .where(eq(schema.pieces.id, piece!.id))
        .run()
    }
    return c.json({ pieces: corps.piece_ids, periode })
  })

  routes.post('/pieces/:id/reactiver', exigerEmployeur, async (c) => {
    const corps = await lireCorps(c, ReactivationSchema)
    if (corps instanceof Response) return corps
    const piece = db
      .select()
      .from(schema.pieces)
      .where(eq(schema.pieces.id, c.req.param('id')))
      .get()
    if (piece === undefined) return c.json({ erreur: 'Pièce inconnue' }, 404)
    const fin = corps.fin ?? aujourdHui()
    const periodes = piece.periodes_inactivite.map((p) =>
      p.fin === null || p.fin > fin ? { ...p, fin: p.debut > fin ? p.debut : fin } : p,
    )
    db.update(schema.pieces)
      .set({ actif: true, periodes_inactivite: periodes })
      .where(eq(schema.pieces.id, piece.id))
      .run()
    return c.json({ ...piece, actif: true, periodes_inactivite: periodes })
  })

  routes.patch('/pieces/:id', exigerEmployeur, async (c) => {
    const corps = await lireCorps(c, ModificationPieceSchema)
    if (corps instanceof Response) return corps
    const id = c.req.param('id')
    const piece = db.select().from(schema.pieces).where(eq(schema.pieces.id, id)).get()
    if (piece === undefined) return c.json({ erreur: 'Pièce inconnue' }, 404)
    if (Object.keys(corps).length > 0) {
      db.update(schema.pieces).set(corps).where(eq(schema.pieces.id, id)).run()
    }
    return c.json(db.select().from(schema.pieces).where(eq(schema.pieces.id, id)).get())
  })

  // --- Tâches -------------------------------------------------------------

  routes.get('/taches', (c) => c.json(db.select().from(schema.taches).all()))

  routes.post('/taches', exigerEmployeur, async (c) => {
    const corps = await lireCorps(c, CreationTacheSchema)
    if (corps instanceof Response) return corps
    if (
      corps.room_id != null &&
      db.select().from(schema.pieces).where(eq(schema.pieces.id, corps.room_id)).get() === undefined
    ) {
      return c.json({ erreur: `Pièce inconnue : ${corps.room_id}` }, 404)
    }
    const tache = {
      id: randomUUID(),
      libelle: corps.libelle,
      room_id: corps.room_id ?? null,
      checklist: corps.checklist ?? [],
      cadence: corps.cadence,
      duree_estimee_min: corps.duree_estimee_min ?? null,
      cible_rotative: corps.cible_rotative ?? null,
      passage_contraint: corps.passage_contraint ?? null,
      instructions: corps.instructions ?? null,
      actif: true,
    }
    db.insert(schema.taches).values(tache).run()
    return c.json(tache, 201)
  })

  routes.patch('/taches/:id', exigerEmployeur, async (c) => {
    const corps = await lireCorps(c, ModificationTacheSchema)
    if (corps instanceof Response) return corps
    const id = c.req.param('id')
    const tache = db.select().from(schema.taches).where(eq(schema.taches.id, id)).get()
    if (tache === undefined) return c.json({ erreur: 'Tâche inconnue' }, 404)
    if (
      corps.room_id != null &&
      db.select().from(schema.pieces).where(eq(schema.pieces.id, corps.room_id)).get() === undefined
    ) {
      return c.json({ erreur: `Pièce inconnue : ${corps.room_id}` }, 404)
    }
    if (Object.keys(corps).length > 0) {
      db.update(schema.taches).set(corps).where(eq(schema.taches.id, id)).run()
    }
    return c.json(db.select().from(schema.taches).where(eq(schema.taches.id, id)).get())
  })

  return routes
}
