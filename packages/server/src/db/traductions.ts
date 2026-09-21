/**
 * Complète les traductions pt-BR d'une base EXISTANTE à partir du catalogue
 * initial, sans jamais écraser : seuls les champs `*_pt` encore vides des
 * pièces et tâches dont l'identifiant correspond au catalogue sont remplis
 * (les personnalisations faites depuis l'espace employeur sont préservées).
 * Idempotent — à lancer après la mise à jour qui introduit le bilinguisme :
 *
 *   npm run db:traduire -w @housekeeping/server
 *   # ou en production (conteneur) :
 *   docker exec housekeeping-app-1 node_modules/.bin/tsx packages/server/src/db/traductions.ts
 */
import { pathToFileURL } from 'node:url'
import { eq } from 'drizzle-orm'
import { PIECES_INITIALES, TACHES_INITIALES } from '@housekeeping/core'
import { ouvrirBase, type Db } from './client.js'
import * as schema from './schema.js'

export function appliquerTraductions(db: Db): { pieces: number; taches: number } {
  let pieces = 0
  for (const piece of PIECES_INITIALES) {
    const existante = db.select().from(schema.pieces).where(eq(schema.pieces.id, piece.id)).get()
    if (existante !== undefined && existante.nom_pt === null && piece.nom_pt !== null) {
      db.update(schema.pieces)
        .set({ nom_pt: piece.nom_pt })
        .where(eq(schema.pieces.id, piece.id))
        .run()
      pieces += 1
    }
  }

  let taches = 0
  for (const tache of TACHES_INITIALES) {
    const existante = db.select().from(schema.taches).where(eq(schema.taches.id, tache.id)).get()
    if (existante === undefined) continue
    const misesAJour: Partial<typeof existante> = {}
    if (existante.libelle_pt === null && tache.libelle_pt !== null) {
      misesAJour.libelle_pt = tache.libelle_pt
    }
    if (existante.checklist_pt == null && tache.checklist_pt !== null) {
      misesAJour.checklist_pt = tache.checklist_pt
    }
    if (existante.instructions_pt === null && tache.instructions_pt !== null) {
      misesAJour.instructions_pt = tache.instructions_pt
    }
    // Habillage pt des cibles de liste (four/micro-ondes) s'il manque.
    if (
      existante.cible_rotative?.type === 'liste' &&
      existante.cible_rotative.valeurs_pt === undefined &&
      tache.cible_rotative?.type === 'liste' &&
      tache.cible_rotative.valeurs_pt !== undefined &&
      existante.cible_rotative.valeurs.join('\u0000') === tache.cible_rotative.valeurs.join('\u0000')
    ) {
      misesAJour.cible_rotative = {
        ...existante.cible_rotative,
        valeurs_pt: tache.cible_rotative.valeurs_pt,
      }
    }
    if (Object.keys(misesAJour).length > 0) {
      db.update(schema.taches).set(misesAJour).where(eq(schema.taches.id, tache.id)).run()
      taches += 1
    }
  }
  return { pieces, taches }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const resultat = appliquerTraductions(ouvrirBase())
  console.log(
    `Traductions complétées : ${resultat.pieces} pièce(s), ${resultat.taches} tâche(s) mises à jour.`,
  )
}
