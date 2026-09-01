/**
 * Moteur de planification (SPEC.md §5). Fonction pure : aucune I/O, aucune
 * horloge, aucun accès base — tout entre par les arguments, tout sort par la
 * valeur de retour. Les interprétations de la spec sont notées étape par étape
 * et récapitulées dans DECISIONS.md.
 */
import { joursEntre, type DateISO } from './dates.js'
import {
  estPieceActiveALaDate,
  type ConfigurationPlanification,
  type DefinitionTache,
  type InstanceHistorique,
  type InterventionHistorique,
  type Piece,
  type TachePlanifiee,
  type TypeIntervention,
} from './domaine.js'

/** Motifs qui déclenchent le repêchage (SPEC §5 étape 5). */
const MOTIFS_REPORT = ['manque_de_temps', 'piece_inaccessible'] as const

function estRotative(tache: DefinitionTache): boolean {
  return tache.cadence === 'mensuelle' || tache.cadence === 'trimestrielle'
}

export function planifier(
  date: DateISO,
  type_passage: TypeIntervention,
  historique: InterventionHistorique[],
  configuration: ConfigurationPlanification,
): TachePlanifiee[] {
  const { pieces, taches, parametres, demandes_en_attente } = configuration
  const pieceParId = new Map(pieces.map((p) => [p.id, p]))
  const tacheParId = new Map(taches.map((t) => [t.id, t]))
  const rangCatalogue = new Map(taches.map((t, i) => [t.id, i]))
  const tachesActives = taches.filter((t) => t.actif)

  const estActive = (pieceId: string): boolean => {
    const piece = pieceParId.get(pieceId)
    return piece !== undefined && estPieceActiveALaDate(piece, date)
  }

  // Historique utile : interventions antérieures ou égales à la date planifiée,
  // en ordre chronologique.
  const passe = historique
    .filter((i) => i.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date))

  // Étape 5 (préparation) — la « dernière intervention » du repêchage est la
  // dernière CLÔTURÉE : une annulée intercalée n'efface pas les reports.
  const derniereCloturee = [...passe].reverse().find((i) => i.statut === 'cloturee') ?? null
  const instancesAReporter: InstanceHistorique[] = derniereCloturee
    ? derniereCloturee.instances.filter(
        (inst) =>
          (inst.statut === 'non_faite' || inst.statut === 'partielle') &&
          inst.motif_non_faite !== null &&
          (MOTIFS_REPORT as readonly string[]).includes(inst.motif_non_faite),
      )
    : []
  const defsReportees = new Set(
    instancesAReporter
      .map((inst) => inst.task_definition_id)
      .filter((id): id is string => id !== null),
  )
  const bandeauReport = (defId: string): DateISO | null =>
    defsReportees.has(defId) ? derniereCloturee!.date : null

  const plan: TachePlanifiee[] = []

  // ------------------------------------------------------------------
  // Étape 1 — socle : cadence `chaque_passage` + celles du type demandé.
  // Une intervention `exceptionnelle` ne porte que le socle commun.
  // ------------------------------------------------------------------
  const cadencesSocle: DefinitionTache['cadence'][] =
    type_passage === 'A'
      ? ['chaque_passage', 'passage_A']
      : type_passage === 'B'
        ? ['chaque_passage', 'passage_B']
        : ['chaque_passage']

  for (const tache of tachesActives) {
    if (!cadencesSocle.includes(tache.cadence)) continue
    if (tache.room_id !== null && !estActive(tache.room_id)) continue
    plan.push({
      task_definition_id: tache.id,
      demande_ponctuelle_id: null,
      libelle: tache.libelle,
      room_id_effectif: tache.room_id,
      cible_resolue: null,
      origine: 'plan',
      reportee_depuis: bandeauReport(tache.id),
    })
  }

  // ------------------------------------------------------------------
  // Étapes 2 et 3 — tâches tournantes : ratio de retard sur la dernière
  // exécution RÉELLE, résolution de la cible rotative, sélection plafonnée.
  // ------------------------------------------------------------------
  interface Candidate {
    tache: DefinitionTache
    r: number
    cible: string | null
    room: string | null
  }
  const candidates: Candidate[] = []

  for (const tache of tachesActives.filter(estRotative)) {
    if (tache.passage_contraint !== null && tache.passage_contraint !== type_passage) continue
    if (tache.room_id !== null && !estActive(tache.room_id)) continue

    let cible: string | null = null
    let room = tache.room_id
    if (tache.cible_rotative !== null) {
      const resolue = resoudreCibleRotative(tache, date, passe, pieces)
      if (resolue === null) continue // aucune cible active : tâche sautée, repêchée plus tard
      cible = resolue.cible
      room = resolue.room_id ?? tache.room_id
    }

    const periode =
      tache.cadence === 'mensuelle'
        ? parametres.periode_mensuelle_jours
        : parametres.periode_trimestrielle_jours
    const derniereExecution = dateDerniereExecution(tache.id, passe)
    let r =
      derniereExecution === null
        ? Number.POSITIVE_INFINITY
        : joursEntre(derniereExecution, date) / periode
    // Étape 5 : une rotative reportée ne double pas le plan, elle est majorée
    // ici et repasse par la sélection (DECISIONS.md).
    if (defsReportees.has(tache.id)) r += 0.5

    if (r >= parametres.seuil_eligibilite) candidates.push({ tache, r, cible, room })
  }

  candidates.sort((a, b) => {
    if (a.r !== b.r) return b.r - a.r
    return rangCatalogue.get(a.tache.id)! - rangCatalogue.get(b.tache.id)! // départage déterministe
  })

  const nbEnRetard = candidates.filter((c) => c.r >= 1).length
  const limite =
    nbEnRetard > parametres.seuil_arriere
      ? parametres.max_rotatives_par_intervention + 1
      : parametres.max_rotatives_par_intervention

  for (const c of candidates.slice(0, limite)) {
    plan.push({
      task_definition_id: c.tache.id,
      demande_ponctuelle_id: null,
      libelle:
        c.tache.cible_rotative?.type === 'liste' && c.cible !== null
          ? `${c.tache.libelle} — ${c.cible}`
          : c.tache.libelle,
      room_id_effectif: c.room,
      cible_resolue: c.cible,
      origine: 'rotation',
      reportee_depuis: bandeauReport(c.tache.id),
    })
  }

  // ------------------------------------------------------------------
  // Étape 4 — demandes ponctuelles (déjà filtrées par l'appelant).
  // ------------------------------------------------------------------
  for (const demande of demandes_en_attente) {
    plan.push({
      task_definition_id: null,
      demande_ponctuelle_id: demande.id,
      libelle: demande.texte,
      room_id_effectif: null,
      cible_resolue: null,
      origine: 'ponctuelle',
      reportee_depuis: null,
    })
  }

  // ------------------------------------------------------------------
  // Étape 5 — repêchage des non-rotatives absentes du plan. Celles que
  // l'étape 1 fournit déjà portent seulement le bandeau (pas de doublon).
  // ------------------------------------------------------------------
  for (const inst of instancesAReporter) {
    const def =
      inst.task_definition_id !== null ? (tacheParId.get(inst.task_definition_id) ?? null) : null
    if (def !== null && estRotative(def)) continue // géré par la majoration de l'étape 2
    if (def !== null && !def.actif) continue

    const dejaPlanifiee =
      (def !== null && plan.some((p) => p.task_definition_id === def.id)) ||
      (inst.demande_ponctuelle_id !== null &&
        plan.some((p) => p.demande_ponctuelle_id === inst.demande_ponctuelle_id))
    if (dejaPlanifiee) continue

    const room = inst.room_id_effectif ?? def?.room_id ?? null
    if (room !== null && !estActive(room)) continue // règle de l'étape 1 : pièce inactive = écartée

    plan.push({
      task_definition_id: def?.id ?? null,
      demande_ponctuelle_id: inst.demande_ponctuelle_id,
      libelle: inst.libelle,
      room_id_effectif: room,
      cible_resolue: inst.cible_resolue,
      origine: inst.origine,
      reportee_depuis: derniereCloturee!.date,
    })
  }

  // ------------------------------------------------------------------
  // Étape 6 — ordonnancement : groupé par pièce dans l'ordre d'affichage,
  // tâches transverses en fin. Tri stable : l'ordre d'insertion (catalogue,
  // puis rotatives, puis ponctuelles, puis repêchages) est préservé au sein
  // d'un même groupe.
  // ------------------------------------------------------------------
  const rangPiece = (p: TachePlanifiee): number => {
    if (p.room_id_effectif === null) return Number.MAX_SAFE_INTEGER
    return pieceParId.get(p.room_id_effectif)?.ordre_affichage ?? Number.MAX_SAFE_INTEGER - 1
  }
  return [...plan].sort((a, b) => rangPiece(a) - rangPiece(b))
}

// ---------------------------------------------------------------------------
// Helpers historiques
// ---------------------------------------------------------------------------

/**
 * Date de la dernière exécution RÉELLE d'une tâche : dernière instance en
 * statut `faite` dans une intervention non annulée. `partielle` ne compte pas
 * (DECISIONS.md).
 */
function dateDerniereExecution(
  defId: string,
  passeChronologique: InterventionHistorique[],
): DateISO | null {
  for (let i = passeChronologique.length - 1; i >= 0; i--) {
    const intervention = passeChronologique[i]!
    if (intervention.statut === 'annulee') continue
    if (
      intervention.instances.some(
        (inst) => inst.task_definition_id === defId && inst.statut === 'faite',
      )
    ) {
      return intervention.date
    }
  }
  return null
}

/** Dernière cible réellement traitée (`faite`) d'une tâche à cible rotative. */
function derniereCibleTraitee(
  defId: string,
  passeChronologique: InterventionHistorique[],
): string | null {
  for (let i = passeChronologique.length - 1; i >= 0; i--) {
    const intervention = passeChronologique[i]!
    if (intervention.statut === 'annulee') continue
    const inst = intervention.instances.find(
      (inst) =>
        inst.task_definition_id === defId && inst.statut === 'faite' && inst.cible_resolue !== null,
    )
    if (inst !== undefined) return inst.cible_resolue
  }
  return null
}

/**
 * Étape 3 — avance le curseur circulaire à partir de la dernière cible traitée,
 * en sautant les pièces inactives. Retourne `null` si aucune cible n'est
 * résoluble (la tâche n'est alors pas éligible).
 */
function resoudreCibleRotative(
  tache: DefinitionTache,
  date: DateISO,
  passeChronologique: InterventionHistorique[],
  pieces: Piece[],
): { cible: string; room_id: string | null } | null {
  const cibleRotative = tache.cible_rotative!
  const derniere = derniereCibleTraitee(tache.id, passeChronologique)

  if (cibleRotative.type === 'liste') {
    const index = derniere !== null ? cibleRotative.valeurs.indexOf(derniere) : -1
    // Cible inconnue (jamais traitée, ou valeur renommée) : on repart du début.
    return {
      cible: cibleRotative.valeurs[(index + 1) % cibleRotative.valeurs.length]!,
      room_id: tache.room_id,
    }
  }

  const listeOrdonnee: Piece[] =
    cibleRotative.type === 'pieces_vitres'
      ? pieces
          .filter((p) => p.inclus_rotation_vitres)
          .sort((a, b) => a.ordre_affichage - b.ordre_affichage)
      : cibleRotative.piece_ids
          .map((id) => pieces.find((p) => p.id === id))
          .filter((p): p is Piece => p !== undefined)
  if (listeOrdonnee.length === 0) return null

  // Dernière cible absente de la liste (pièce retirée de la rotation) : on
  // repart de la première pièce active (index -1 → départ à 0).
  const index = derniere !== null ? listeOrdonnee.findIndex((p) => p.id === derniere) : -1
  for (let k = 1; k <= listeOrdonnee.length; k++) {
    const piece = listeOrdonnee[(index + k) % listeOrdonnee.length]!
    if (estPieceActiveALaDate(piece, date)) return { cible: piece.id, room_id: piece.id }
  }
  return null
}
