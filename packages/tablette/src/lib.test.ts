import { describe, expect, it } from 'vitest'
import {
  checklistLocalisee,
  grouperParPiece,
  instructionsLocalisees,
  libelleInstance,
  nomPieceLocalise,
  progression,
} from './lib.js'
import type { DefinitionTacheDto, InstanceDto, PieceDto } from './types.js'

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
  { id: 'cuisine', nom: 'Cuisine', nom_pt: 'Cozinha', ordre_affichage: 10 },
  { id: 'salle_de_bain', nom: 'Salle de bain', nom_pt: null, ordre_affichage: 90 },
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

describe('localisation des données (fr/pt, repli français)', () => {
  const definition: DefinitionTacheDto = {
    id: 'four_micro_ondes',
    libelle: 'Intérieur du four ou du micro-ondes',
    libelle_pt: 'Interior do forno ou do micro-ondas',
    checklist: ['Étape'],
    checklist_pt: ['Etapa'],
    instructions: 'Consigne',
    instructions_pt: null,
    cible_rotative: {
      type: 'liste',
      valeurs: ['Four', 'Micro-ondes'],
      valeurs_pt: ['Forno', 'Micro-ondas'],
    },
  }

  it('nom de pièce : pt quand l’appareil est en portugais, repli sinon', () => {
    expect(nomPieceLocalise(PIECES[0]!, 'pt-BR')).toBe('Cozinha')
    expect(nomPieceLocalise(PIECES[0]!, 'fr')).toBe('Cuisine')
    expect(nomPieceLocalise(PIECES[1]!, 'pt-BR')).toBe('Salle de bain') // pas de traduction
  })

  it('libellé d’instance : définition traduite, cible de liste habillée par index', () => {
    const avecCible = { ...instance('i1', null), cible_resolue: 'Micro-ondes' }
    expect(libelleInstance(avecCible, definition, 'pt-BR')).toBe(
      'Interior do forno ou do micro-ondas — Micro-ondas',
    )
    expect(libelleInstance(avecCible, definition, 'fr')).toBe(
      'Intérieur du four ou du micro-ondes — Micro-ondes',
    )
    const cibleFour = { ...avecCible, cible_resolue: 'Four' }
    expect(libelleInstance(cibleFour, definition, 'pt')).toBe(
      'Interior do forno ou do micro-ondas — Forno',
    )
  })

  it('sans définition (demande ponctuelle), l’instantané reste tel quel', () => {
    const ponctuelle = { ...instance('i2', null), libelle: 'Nettoyer le tapis' }
    expect(libelleInstance(ponctuelle, undefined, 'pt-BR')).toBe('Nettoyer le tapis')
  })

  it('checklist et instructions : traduction si présente, repli français sinon', () => {
    expect(checklistLocalisee(definition, 'pt')).toEqual(['Etapa'])
    expect(checklistLocalisee(definition, 'fr')).toEqual(['Étape'])
    expect(instructionsLocalisees(definition, 'pt')).toBe('Consigne') // instructions_pt null → repli
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
