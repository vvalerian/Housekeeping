/**
 * Logique d'affichage pure (testée unitairement, sans React) : groupement du
 * plan par carte de pièce (SPEC §6) et progression.
 */
import type { InstanceDto, PieceDto } from './types.js'

export interface GroupePlan {
  cle: string
  /** `null` pour le groupe des tâches transverses (fin d'intervention). */
  titre: string | null
  instances: InstanceDto[]
}

/**
 * Groupe les instances par pièce, dans l'ordre d'affichage des pièces, en
 * préservant l'ordre du plan au sein d'un groupe ; les transverses ferment la
 * marche (l'API les ordonne déjà ainsi, le groupement le garantit même si un
 * ajout spontané arrive en cours de route).
 */
export function grouperParPiece(instances: InstanceDto[], pieces: PieceDto[]): GroupePlan[] {
  const pieceParId = new Map(pieces.map((p) => [p.id, p]))
  const groupes = new Map<string, GroupePlan & { rang: number }>()
  for (const instance of instances) {
    const cle = instance.room_id_effectif ?? '__transverses__'
    let groupe = groupes.get(cle)
    if (groupe === undefined) {
      const piece =
        instance.room_id_effectif === null ? undefined : pieceParId.get(instance.room_id_effectif)
      groupe = {
        cle,
        titre:
          instance.room_id_effectif === null ? null : (piece?.nom ?? instance.room_id_effectif),
        rang:
          instance.room_id_effectif === null
            ? Number.MAX_SAFE_INTEGER
            : (piece?.ordre_affichage ?? Number.MAX_SAFE_INTEGER - 1),
        instances: [],
      }
      groupes.set(cle, groupe)
    }
    groupe.instances.push(instance)
  }
  return [...groupes.values()]
    .sort((a, b) => a.rang - b.rang)
    .map(({ rang: _rang, ...groupe }) => groupe)
}

/** Une instance est « traitée » dès qu'elle a quitté l'état `a_faire`. */
export function progression(instances: InstanceDto[]): {
  traitees: number
  total: number
  ratio: number
} {
  const total = instances.length
  const traitees = instances.filter((i) => i.statut !== 'a_faire').length
  return { traitees, total, ratio: total === 0 ? 0 : traitees / total }
}

/** Date longue lisible (« jeudi 4 septembre »), dans la langue de l'appareil. */
export function formaterDateLongue(dateIso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${dateIso}T00:00:00`))
}

/** Date courte (« 4 septembre ») pour les bandeaux « reportée depuis le… ». */
export function formaterDateCourte(dateIso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(
    new Date(`${dateIso}T00:00:00`),
  )
}

/** Date du jour au sens local de l'appareil (AAAA-MM-JJ). */
export function dateDuJour(): string {
  return new Date().toLocaleDateString('en-CA')
}
