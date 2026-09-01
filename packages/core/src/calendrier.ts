/**
 * Génération du calendrier des interventions (SPEC.md §5, dernier paragraphe) :
 * deux interventions par semaine, jours configurables, alternance stricte A/B.
 * Une intervention annulée ne consomme pas son tour d'alternance — la suivante
 * reprend le type qui n'a pas eu lieu. Fonction pure, comme le moteur.
 */
import { jourSemaine, plusJours, type DateISO, type JourSemaine } from './dates.js'
import type { StatutIntervention, TypeIntervention } from './domaine.js'

export interface InterventionExistante {
  date: DateISO
  type: TypeIntervention
  statut: StatutIntervention
}

export interface OptionsCalendrier {
  jours_intervention: JourSemaine[]
  /** Type du tout premier passage si aucun historique A/B n'existe. */
  premier_type_passage: 'A' | 'B'
}

export interface InterventionAPlanifier {
  date: DateISO
  type: 'A' | 'B'
}

/**
 * Propose les interventions manquantes entre `depuis` et `jusqua` (bornes
 * incluses). Les interventions existantes sont respectées :
 * - un jour déjà occupé (même par une annulée : la date a été consommée) ne
 *   reçoit pas de doublon ;
 * - seules les A/B non annulées font avancer l'alternance — annulées et
 *   exceptionnelles sont transparentes pour elle.
 */
export function genererCalendrier(
  depuis: DateISO,
  jusqua: DateISO,
  existantes: InterventionExistante[],
  options: OptionsCalendrier,
): InterventionAPlanifier[] {
  const chronologiques = [...existantes].sort((a, b) => a.date.localeCompare(b.date))

  // État d'alternance hérité de tout ce qui précède la fenêtre.
  let dernierType: 'A' | 'B' | null = null
  for (const intervention of chronologiques) {
    if (intervention.date >= depuis) break
    if (intervention.statut !== 'annulee' && intervention.type !== 'exceptionnelle') {
      dernierType = intervention.type
    }
  }

  const resultat: InterventionAPlanifier[] = []
  for (let date = depuis; date <= jusqua; date = plusJours(date, 1)) {
    const duJour = chronologiques.filter((i) => i.date === date)
    const activeAB = duJour.find(
      (i) => i.statut !== 'annulee' && i.type !== 'exceptionnelle',
    )
    if (activeAB !== undefined) dernierType = activeAB.type as 'A' | 'B'
    if (duJour.length > 0) continue
    if (!options.jours_intervention.includes(jourSemaine(date))) continue

    const type: 'A' | 'B' =
      dernierType === null ? options.premier_type_passage : dernierType === 'A' ? 'B' : 'A'
    resultat.push({ date, type })
    dernierType = type
  }
  return resultat
}
