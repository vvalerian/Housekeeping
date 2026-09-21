import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { ouvrirBase } from './client.js'
import * as schema from './schema.js'
import { chargerCatalogue } from './seed.js'
import { appliquerTraductions } from './traductions.js'

describe('traductions pt-BR', () => {
  it('le seed expose les traductions, le script complète une base qui en manque sans écraser', () => {
    const db = ouvrirBase(':memory:')
    chargerCatalogue(db)

    // Le seed neuf est déjà bilingue.
    const cuisine = db.select().from(schema.pieces).where(eq(schema.pieces.id, 'cuisine')).get()
    expect(cuisine?.nom_pt).toBe('Cozinha')

    // Simule une base d'avant le bilinguisme, avec une personnalisation.
    db.update(schema.pieces).set({ nom_pt: null }).run()
    db.update(schema.taches)
      .set({ libelle_pt: null, checklist_pt: null, instructions_pt: null })
      .run()
    db.update(schema.pieces)
      .set({ nom_pt: 'Cozinha gourmet' })
      .where(eq(schema.pieces.id, 'cuisine'))
      .run()

    const resultat = appliquerTraductions(db)
    expect(resultat.pieces).toBe(14) // toutes sauf la cuisine personnalisée
    expect(resultat.taches).toBeGreaterThan(0)

    // La personnalisation est préservée, le reste est rempli.
    expect(
      db.select().from(schema.pieces).where(eq(schema.pieces.id, 'cuisine')).get()?.nom_pt,
    ).toBe('Cozinha gourmet')
    expect(
      db.select().from(schema.pieces).where(eq(schema.pieces.id, 'salon')).get()?.nom_pt,
    ).toBe('Sala de estar')
    const draps = db.select().from(schema.taches).where(eq(schema.taches.id, 'draps')).get()
    expect(draps?.libelle_pt).toBe('Troca da roupa de cama')
    expect(draps?.checklist_pt).toHaveLength(3)

    // Idempotent : un second passage ne change rien.
    expect(appliquerTraductions(db)).toEqual({ pieces: 0, taches: 0 })
  })
})
