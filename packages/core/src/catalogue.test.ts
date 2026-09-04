import { describe, expect, it } from 'vitest'
import { PIECES_INITIALES, TACHES_INITIALES } from './catalogue.js'
import { CHOIX_FOYER, ORDRE_PIECES, TRAVAUX_EN_COURS } from './configuration.js'
import { DefinitionTacheSchema, PieceSchema } from './domaine.js'

describe('catalogue initial', () => {
  it('toutes les pièces respectent le schéma', () => {
    for (const piece of PIECES_INITIALES) {
      const resultat = PieceSchema.safeParse(piece)
      expect(resultat.success, `pièce ${piece.id} : ${JSON.stringify(resultat.error?.issues)}`).toBe(
        true,
      )
    }
  })

  it('toutes les tâches respectent le schéma', () => {
    for (const tache of TACHES_INITIALES) {
      const resultat = DefinitionTacheSchema.safeParse(tache)
      expect(resultat.success, `tâche ${tache.id} : ${JSON.stringify(resultat.error?.issues)}`).toBe(
        true,
      )
    }
  })

  it('contient les 15 pièces de la spec, identifiants et ordres uniques', () => {
    expect(PIECES_INITIALES).toHaveLength(15)
    expect(new Set(PIECES_INITIALES.map((p) => p.id)).size).toBe(15)
    expect(new Set(PIECES_INITIALES.map((p) => p.ordre_affichage)).size).toBe(15)
    expect(ORDRE_PIECES).toHaveLength(15)
  })

  it('répartit les tâches selon les cadences de la spec (§4)', () => {
    const parCadence = (cadence: string) =>
      TACHES_INITIALES.filter((t) => t.cadence === cadence).length
    expect(new Set(TACHES_INITIALES.map((t) => t.id)).size).toBe(TACHES_INITIALES.length)
    expect(parCadence('chaque_passage')).toBe(5)
    expect(parCadence('passage_A')).toBe(6)
    expect(parCadence('passage_B')).toBe(6)
    expect(parCadence('mensuelle')).toBe(4)
    expect(parCadence('trimestrielle')).toBe(4)
  })

  it('toutes les références de pièces existent', () => {
    const pieceIds = new Set(PIECES_INITIALES.map((p) => p.id))
    for (const tache of TACHES_INITIALES) {
      if (tache.room_id !== null) {
        expect(pieceIds.has(tache.room_id), `room_id inconnu sur ${tache.id}`).toBe(true)
      }
      if (tache.cible_rotative?.type === 'pieces') {
        for (const id of tache.cible_rotative.piece_ids) {
          expect(pieceIds.has(id), `cible inconnue ${id} sur ${tache.id}`).toBe(true)
        }
      }
    }
    for (const id of CHOIX_FOYER.pieces_rotation_vitres) {
      expect(pieceIds.has(id), `pièce de rotation vitres inconnue : ${id}`).toBe(true)
    }
    for (const id of TRAVAUX_EN_COURS.piece_ids) {
      expect(pieceIds.has(id), `pièce en travaux inconnue : ${id}`).toBe(true)
    }
  })

  it('le marquage vitres reflète exactement la configuration', () => {
    const marquees = PIECES_INITIALES.filter((p) => p.inclus_rotation_vitres).map((p) => p.id)
    expect(marquees.sort()).toEqual([...CHOIX_FOYER.pieces_rotation_vitres].sort())
  })
})
