/**
 * Les dates calendaires du domaine sont des chaînes ISO `AAAA-MM-JJ`, comparées
 * lexicographiquement. Aucun objet `Date` ne circule dans le domaine : cela évite
 * tout problème de fuseau horaire sur une application purement calendaire.
 */
export type DateISO = string

const JOUR_MS = 86_400_000

/** Index aligné sur `Date.prototype.getUTCDay()` (0 = dimanche). */
export const JOURS_SEMAINE = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
] as const

export type JourSemaine = (typeof JOURS_SEMAINE)[number]

/** Nombre de jours entre deux dates (`a - de`, positif si `a` est après `de`). */
export function joursEntre(de: DateISO, a: DateISO): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / JOUR_MS)
}

export function plusJours(date: DateISO, jours: number): DateISO {
  return new Date(Date.parse(`${date}T00:00:00Z`) + jours * JOUR_MS).toISOString().slice(0, 10)
}

export function jourSemaine(date: DateISO): JourSemaine {
  return JOURS_SEMAINE[new Date(`${date}T00:00:00Z`).getUTCDay()]!
}
