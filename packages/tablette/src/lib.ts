/**
 * Logique d'affichage pure (testée unitairement, sans React) : groupement du
 * plan par carte de pièce (SPEC §6) et progression.
 */
import type { DefinitionTacheDto, InstanceDto, PieceDto } from './types.js'

/** `true` quand l'appareil est réglé en portugais (données `*_pt` affichées). */
export function estPortugais(langue: string): boolean {
  return langue.toLowerCase().startsWith('pt')
}

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

// ---------------------------------------------------------------------------
// Localisation des DONNÉES du catalogue (bilinguisme fr/pt, repli français) —
// les champs `*_pt` viennent de la base, les textes libres (demandes,
// commentaires) restent dans la langue de leur auteur.
// ---------------------------------------------------------------------------

export function nomPieceLocalise(piece: PieceDto, langue: string): string {
  return estPortugais(langue) ? (piece.nom_pt ?? piece.nom) : piece.nom
}

/**
 * Libellé d'une instance : celui de sa définition dans la langue demandée
 * (recomposé avec la cible pour les sous-rotations de liste, ex. « Interior
 * do forno ou do micro-ondas — Forno ») ; sans définition (demande
 * ponctuelle, ajout spontané), l'instantané `libelle` tel qu'écrit.
 */
export function libelleInstance(
  instance: InstanceDto,
  definition: DefinitionTacheDto | undefined,
  langue: string,
): string {
  if (definition === undefined) return instance.libelle
  const pt = estPortugais(langue)
  const base = pt ? (definition.libelle_pt ?? definition.libelle) : definition.libelle
  if (instance.cible_resolue !== null && definition.cible_rotative?.type === 'liste') {
    const { valeurs, valeurs_pt } = definition.cible_rotative
    const index = valeurs.indexOf(instance.cible_resolue)
    const cible =
      pt && index !== -1 && valeurs_pt?.[index] !== undefined
        ? valeurs_pt[index]
        : instance.cible_resolue
    return `${base} — ${cible}`
  }
  return base
}

export function checklistLocalisee(definition: DefinitionTacheDto, langue: string): string[] {
  return estPortugais(langue) ? (definition.checklist_pt ?? definition.checklist) : definition.checklist
}

export function instructionsLocalisees(
  definition: DefinitionTacheDto,
  langue: string,
): string | null {
  return estPortugais(langue)
    ? (definition.instructions_pt ?? definition.instructions)
    : definition.instructions
}
