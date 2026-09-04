import { describe, expect, it } from 'vitest'
import { grouperParPiece, progression } from './lib.js'
import type { InstanceDto, PieceDto } from './types.js'

const instance = (id: string, room: string | null, statut: InstanceDto['statut'] = 'a_faire') =>
  ({
    id,
    intervention_id: 'i1',
    task_definition_id: id,
    demande_ponctuelle_id: null,
    libelle: id,
    room_id_effectif: room,
    cible_resolue: null,
    statut,
    motif_non_faite: null,
    commentaire: null,
    horodatage_validation: null,
    origine: 'plan',
    reportee_depuis: null,
  }) satisfies InstanceDto

const PIECES: PieceDto[] = [
  { id: 'cuisine', nom: 'Cuisine', ordre_affichage: 10 },
  { id: 'salle_de_bain', nom: 'Salle de bain', ordre_affichage: 90 },
]

describe('grouperParPiece', () => {
  it('groupe par pièce dans l’ordre d’affichage, transverses en fin', () => {
    const plan = [
      instance('t3', 'salle_de_bain'),
      instance('t1', 'cuisine'),
      instance('t2', 'cuisine'),
      instance('t4', null),
      instance('t5', null),
    ]
    const groupes = grouperParPiece(plan, PIECES)
    expect(groupes.map((g) => g.titre)).toEqual(['Cuisine', 'Salle de bain', null])
    expect(groupes[0]!.instances.map((i) => i.id)).toEqual(['t1', 't2'])
    expect(groupes.at(-1)!.instances.map((i) => i.id)).toEqual(['t4', 't5'])
  })

  it('une pièce inconnue reste affichable (repli sur son identifiant)', () => {
    const groupes = grouperParPiece([instance('t1', 'grenier')], PIECES)
    expect(groupes[0]!.titre).toBe('grenier')
  })
})

describe('progression', () => {
  it('compte comme traitée toute instance sortie de a_faire', () => {
    const plan = [
      instance('t1', null, 'faite'),
      instance('t2', null, 'partielle'),
      instance('t3', null, 'non_faite'),
      instance('t4', null, 'a_faire'),
    ]
    expect(progression(plan)).toEqual({ traitees: 3, total: 4, ratio: 0.75 })
    expect(progression([])).toEqual({ traitees: 0, total: 0, ratio: 0 })
  })
})
