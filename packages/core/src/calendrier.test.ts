import { describe, expect, it } from 'vitest'
import { genererCalendrier, type OptionsCalendrier } from './calendrier.js'

// 2026-09-01 est un mardi.
const OPTIONS: OptionsCalendrier = {
  jours_intervention: ['mardi', 'vendredi'],
  premier_type_passage: 'A',
}

describe('génération du calendrier', () => {
  it('alterne strictement A/B sur les jours configurés', () => {
    const plan = genererCalendrier('2026-09-01', '2026-09-14', [], OPTIONS)
    expect(plan).toEqual([
      { date: '2026-09-01', type: 'A' },
      { date: '2026-09-04', type: 'B' },
      { date: '2026-09-08', type: 'A' },
      { date: '2026-09-11', type: 'B' },
    ])
  })

  it('démarre sur le premier type configuré quand l’historique est vide', () => {
    const plan = genererCalendrier('2026-09-01', '2026-09-04', [], {
      ...OPTIONS,
      premier_type_passage: 'B',
    })
    expect(plan[0]).toEqual({ date: '2026-09-01', type: 'B' })
  })

  it('hérite de l’alternance des interventions antérieures à la fenêtre', () => {
    const plan = genererCalendrier(
      '2026-09-01',
      '2026-09-04',
      [{ date: '2026-08-28', type: 'A', statut: 'cloturee' }],
      OPTIONS,
    )
    expect(plan[0]).toEqual({ date: '2026-09-01', type: 'B' })
  })

  it('une intervention annulée ne consomme pas son tour : la suivante reprend son type', () => {
    const plan = genererCalendrier(
      '2026-09-05',
      '2026-09-11',
      [
        { date: '2026-09-01', type: 'A', statut: 'cloturee' },
        { date: '2026-09-04', type: 'B', statut: 'annulee' },
      ],
      OPTIONS,
    )
    expect(plan).toEqual([
      { date: '2026-09-08', type: 'B' },
      { date: '2026-09-11', type: 'A' },
    ])
  })

  it('ne crée pas de doublon sur un jour déjà occupé, même par une annulée', () => {
    const plan = genererCalendrier(
      '2026-09-01',
      '2026-09-04',
      [
        { date: '2026-09-01', type: 'A', statut: 'planifiee' },
        { date: '2026-09-04', type: 'B', statut: 'annulee' },
      ],
      OPTIONS,
    )
    expect(plan).toEqual([])
  })

  it('les interventions exceptionnelles sont transparentes pour l’alternance', () => {
    const plan = genererCalendrier(
      '2026-09-01',
      '2026-09-04',
      [
        { date: '2026-08-28', type: 'A', statut: 'cloturee' },
        { date: '2026-08-31', type: 'exceptionnelle', statut: 'cloturee' },
      ],
      OPTIONS,
    )
    expect(plan[0]).toEqual({ date: '2026-09-01', type: 'B' })
  })
})
