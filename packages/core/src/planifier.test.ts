import { describe, expect, it } from 'vitest'
import { PIECES_INITIALES, TACHES_INITIALES } from './catalogue.js'
import { PARAMETRES_PLANIFICATION } from './configuration.js'
import { plusJours } from './dates.js'
import type {
  ConfigurationPlanification,
  InstanceHistorique,
  InterventionHistorique,
  Piece,
  StatutInstance,
  TachePlanifiee,
} from './domaine.js'
import { planifier } from './planifier.js'

// ---------------------------------------------------------------------------
// Aides de construction
// ---------------------------------------------------------------------------

const REF = '2026-09-01'

function configuration(
  surcharges: Partial<ConfigurationPlanification> = {},
): ConfigurationPlanification {
  return {
    pieces: PIECES_INITIALES,
    taches: TACHES_INITIALES,
    parametres: PARAMETRES_PLANIFICATION,
    demandes_en_attente: [],
    ...surcharges,
  }
}

function instance(
  defId: string | null,
  statut: StatutInstance,
  extra: Partial<InstanceHistorique> = {},
): InstanceHistorique {
  return {
    task_definition_id: defId,
    demande_ponctuelle_id: null,
    libelle: defId ?? 'tâche libre',
    room_id_effectif: null,
    cible_resolue: null,
    statut,
    motif_non_faite: null,
    origine: 'plan',
    ...extra,
  }
}

function intervention(
  date: string,
  type: InterventionHistorique['type'],
  statut: InterventionHistorique['statut'],
  instances: InstanceHistorique[] = [],
): InterventionHistorique {
  return { date, type, statut, instances }
}

/** Ajoute une période d'inactivité à une pièce, sans muter le catalogue. */
function avecPieceInactive(
  pieces: Piece[],
  pieceId: string,
  periode: { debut: string; fin: string | null },
): Piece[] {
  return pieces.map((p) =>
    p.id === pieceId
      ? { ...p, periodes_inactivite: [...p.periodes_inactivite, { ...periode, motif: 'test' }] }
      : p,
  )
}

/**
 * Historique « régime établi » : toutes les rotatives exécutées récemment
 * (mensuelles il y a 10 jours, trimestrielles il y a 30), aucun report en
 * attente. Ratios ≈ 0.33, aucune rotative éligible.
 */
function historiqueCalme(ref = REF): InterventionHistorique[] {
  return [
    intervention(plusJours(ref, -30), 'A', 'cloturee', [
      instance('four_micro_ondes', 'faite', { cible_resolue: 'Four' }),
      instance('refrigerateur', 'faite'),
      instance('plinthes_portes', 'faite'),
      instance('lave_linge_entretien', 'faite'),
    ]),
    intervention(plusJours(ref, -10), 'B', 'cloturee', [
      instance('draps', 'faite'),
      instance('vitres', 'faite', { cible_resolue: 'cuisine' }),
      instance('contenants_poubelles', 'faite'),
      instance('aspiration_canape', 'faite'),
    ]),
  ]
}

const ids = (plan: TachePlanifiee[]) => plan.map((p) => p.task_definition_id)
const rotatives = (plan: TachePlanifiee[]) => plan.filter((p) => p.origine === 'rotation')

// ---------------------------------------------------------------------------
// Étape 1 — socle
// ---------------------------------------------------------------------------

describe('étape 1 — socle du passage', () => {
  it('passage A : chaque_passage + passage_A, rien du passage B', () => {
    const plan = planifier(REF, 'A', historiqueCalme(), configuration())
    const presents = ids(plan)
    for (const attendu of [
      'cuisine_nettoyage',
      'lave_vaisselle',
      'linge',
      'poubelles',
      'rangement_leger',
      'salle_de_bain_complet',
      'wc_salle_de_bain_complet',
      'sols_zone_jour',
      'depoussierage_zone_jour',
      'bureau_madame_entretien',
      'bureau_monsieur_entretien',
    ]) {
      expect(presents).toContain(attendu)
    }
    for (const absent of [
      'salle_de_douche_complet',
      'chambre_enfant_1_entretien',
      'chambre_parents_entretien',
      'sols_zone_jour_rapide',
    ]) {
      expect(presents).not.toContain(absent)
    }
  })

  it('passage B : chambres et salle de douche, pas les bureaux', () => {
    const plan = planifier(REF, 'B', historiqueCalme(), configuration())
    const presents = ids(plan)
    for (const attendu of [
      'salle_de_douche_complet',
      'wc_salle_de_douche_complet',
      'chambre_enfant_1_entretien',
      'chambre_enfant_2_entretien',
      'chambre_parents_entretien',
      'sols_zone_jour_rapide',
      'cuisine_nettoyage',
    ]) {
      expect(presents).toContain(attendu)
    }
    for (const absent of ['salle_de_bain_complet', 'bureau_madame_entretien', 'sols_zone_jour']) {
      expect(presents).not.toContain(absent)
    }
  })

  it('intervention exceptionnelle : socle chaque_passage uniquement', () => {
    const plan = planifier(REF, 'exceptionnelle', historiqueCalme(), configuration())
    const socle = plan.filter((p) => p.origine === 'plan')
    expect(ids(socle).sort()).toEqual(
      ['cuisine_nettoyage', 'lave_vaisselle', 'linge', 'poubelles', 'rangement_leger'].sort(),
    )
  })

  it('écarte les tâches dont la pièce est inactive à la date', () => {
    const pieces = avecPieceInactive(PIECES_INITIALES, 'bureau_madame', {
      debut: '2026-08-20',
      fin: null,
    })
    const plan = planifier(REF, 'A', historiqueCalme(), configuration({ pieces }))
    expect(ids(plan)).not.toContain('bureau_madame_entretien')
    expect(ids(plan)).toContain('bureau_monsieur_entretien')
  })

  it("période d'inactivité : bornes incluses, fin nulle = indéfinie", () => {
    const pieces = avecPieceInactive(PIECES_INITIALES, 'bureau_madame', {
      debut: '2026-09-01',
      fin: '2026-09-30',
    })
    const conf = configuration({ pieces })
    expect(ids(planifier('2026-08-31', 'A', [], conf))).toContain('bureau_madame_entretien')
    expect(ids(planifier('2026-09-01', 'A', [], conf))).not.toContain('bureau_madame_entretien')
    expect(ids(planifier('2026-09-30', 'A', [], conf))).not.toContain('bureau_madame_entretien')
    expect(ids(planifier('2026-10-01', 'A', [], conf))).toContain('bureau_madame_entretien')

    const ouverte = avecPieceInactive(PIECES_INITIALES, 'bureau_madame', {
      debut: '2026-09-01',
      fin: null,
    })
    expect(
      ids(planifier('2027-06-01', 'A', [], configuration({ pieces: ouverte }))),
    ).not.toContain('bureau_madame_entretien')
  })
})

// ---------------------------------------------------------------------------
// Étape 2 — sélection des tâches tournantes
// ---------------------------------------------------------------------------

describe('étape 2 — tâches tournantes', () => {
  it('démarrage (historique vide) : tout est à +∞, arriéré > seuil, 2 rotatives dans l’ordre du catalogue', () => {
    const plan = planifier(REF, 'A', [], configuration())
    const selection = rotatives(plan)
    expect(selection).toHaveLength(2)
    // draps est contraint au passage B : les deux premières rotatives du
    // catalogue candidates sur un passage A sont vitres puis contenants.
    expect(ids(selection)).toEqual(['vitres', 'contenants_poubelles'])
  })

  it('régime établi : aucune rotative sous le seuil d’éligibilité', () => {
    const plan = planifier(REF, 'A', historiqueCalme(), configuration())
    expect(rotatives(plan)).toHaveLength(0)
  })

  it('une seule éligible (r = 0.9) : sélectionnée, sans déclencher l’arriéré', () => {
    const historique = [
      intervention(plusJours(REF, -30), 'A', 'cloturee', [
        instance('four_micro_ondes', 'faite', { cible_resolue: 'Four' }),
        instance('refrigerateur', 'faite'),
        instance('plinthes_portes', 'faite'),
        instance('lave_linge_entretien', 'faite'),
      ]),
      intervention(plusJours(REF, -27), 'B', 'cloturee', [
        instance('contenants_poubelles', 'faite'),
      ]),
      intervention(plusJours(REF, -10), 'B', 'cloturee', [
        instance('draps', 'faite'),
        instance('vitres', 'faite', { cible_resolue: 'cuisine' }),
        instance('aspiration_canape', 'faite'),
      ]),
    ]
    const plan = planifier(REF, 'A', historique, configuration())
    expect(ids(rotatives(plan))).toEqual(['contenants_poubelles'])
  })

  it('arriéré égal au seuil (3 en retard) : plafond inchangé, une seule rotative', () => {
    const historique = [
      intervention(plusJours(REF, -30), 'A', 'cloturee', [
        instance('four_micro_ondes', 'faite', { cible_resolue: 'Four' }),
        instance('refrigerateur', 'faite'),
        instance('plinthes_portes', 'faite'),
        instance('lave_linge_entretien', 'faite'),
      ]),
      // draps, vitres, contenants en retard net ; canapé récent.
      intervention(plusJours(REF, -43), 'B', 'cloturee', [instance('draps', 'faite')]),
      intervention(plusJours(REF, -38), 'B', 'cloturee', [
        instance('vitres', 'faite', { cible_resolue: 'cuisine' }),
      ]),
      intervention(plusJours(REF, -31), 'B', 'cloturee', [
        instance('contenants_poubelles', 'faite'),
      ]),
      intervention(plusJours(REF, -5), 'B', 'cloturee', [instance('aspiration_canape', 'faite')]),
    ]
    const plan = planifier(REF, 'B', historique, configuration())
    expect(ids(rotatives(plan))).toEqual(['draps']) // la plus en retard (r = 43/30)
  })

  it('arriéré dépassant le seuil (4 en retard) : une rotative supplémentaire', () => {
    const historique = [
      intervention(plusJours(REF, -30), 'A', 'cloturee', [
        instance('four_micro_ondes', 'faite', { cible_resolue: 'Four' }),
        instance('refrigerateur', 'faite'),
        instance('plinthes_portes', 'faite'),
        instance('lave_linge_entretien', 'faite'),
      ]),
      intervention(plusJours(REF, -43), 'B', 'cloturee', [instance('draps', 'faite')]),
      intervention(plusJours(REF, -38), 'B', 'cloturee', [
        instance('vitres', 'faite', { cible_resolue: 'cuisine' }),
      ]),
      intervention(plusJours(REF, -33), 'B', 'cloturee', [
        instance('contenants_poubelles', 'faite'),
      ]),
      intervention(plusJours(REF, -31), 'B', 'cloturee', [instance('aspiration_canape', 'faite')]),
    ]
    const plan = planifier(REF, 'B', historique, configuration())
    // Les deux plus en retard sont retenues (l'ordre final est celui des
    // pièces, étape 6) ; contenants et canapé, moins en retard, restent dehors.
    expect(ids(rotatives(plan)).sort()).toEqual(['draps', 'vitres'].sort())
  })

  it('rotative dont la pièce est inactive : sautée sans casser le compteur, repêchée à la réactivation', () => {
    // Le canapé (pièce attenante) n'a jamais été aspiré ; toutes les autres
    // rotatives sont à jour.
    const historique = historiqueCalme().map((i) => ({
      ...i,
      instances: i.instances.filter((inst) => inst.task_definition_id !== 'aspiration_canape'),
    }))
    const travaux = avecPieceInactive(PIECES_INITIALES, 'piece_attenante', {
      debut: '2026-08-01',
      fin: '2026-09-15',
    })
    // Pendant les travaux : rien (le canapé est la seule candidate possible et
    // sa pièce est condamnée).
    const pendant = planifier(REF, 'A', historique, configuration({ pieces: travaux }))
    expect(rotatives(pendant)).toHaveLength(0)
    // Après réactivation : le canapé revient en tête (r = +∞).
    const apres = planifier('2026-09-18', 'A', historique, configuration({ pieces: travaux }))
    expect(ids(rotatives(apres))).toEqual(['aspiration_canape'])
  })

  it('les draps ne tombent que sur un passage B (contrainte de passage)', () => {
    expect(ids(planifier(REF, 'A', [], configuration()))).not.toContain('draps')
    expect(ids(planifier(REF, 'exceptionnelle', [], configuration()))).not.toContain('draps')
    const planB = planifier(REF, 'B', [], configuration())
    expect(ids(rotatives(planB))).toContain('draps')
  })
})

// ---------------------------------------------------------------------------
// Étape 3 — sous-rotation de cible
// ---------------------------------------------------------------------------

describe('étape 3 — cibles rotatives', () => {
  /** Historique où seule la rotative `vitres` est en retard (40 jours). */
  function historiqueVitresEnRetard(cible: string | null): InterventionHistorique[] {
    return [
      intervention(plusJours(REF, -40), 'A', 'cloturee', [
        cible === null
          ? instance('four_micro_ondes', 'faite', { cible_resolue: 'Four' }) // remplissage
          : instance('vitres', 'faite', { cible_resolue: cible }),
      ]),
      intervention(plusJours(REF, -30), 'A', 'cloturee', [
        instance('four_micro_ondes', 'faite', { cible_resolue: 'Four' }),
        instance('refrigerateur', 'faite'),
        instance('plinthes_portes', 'faite'),
        instance('lave_linge_entretien', 'faite'),
      ]),
      intervention(plusJours(REF, -10), 'B', 'cloturee', [
        instance('draps', 'faite'),
        instance('contenants_poubelles', 'faite'),
        instance('aspiration_canape', 'faite'),
      ]),
    ]
  }

  it('première exécution : première pièce active de la rotation des vitres', () => {
    const plan = planifier(REF, 'A', historiqueVitresEnRetard(null), configuration())
    const vitres = plan.find((p) => p.task_definition_id === 'vitres')
    expect(vitres).toBeDefined()
    expect(vitres!.cible_resolue).toBe('cuisine')
    expect(vitres!.room_id_effectif).toBe('cuisine')
  })

  it('le curseur avance circulairement à partir de la dernière cible traitée', () => {
    const plan = planifier(REF, 'A', historiqueVitresEnRetard('salon'), configuration())
    expect(plan.find((p) => p.task_definition_id === 'vitres')!.cible_resolue).toBe(
      'piece_attenante',
    )
  })

  it('le curseur saute une pièce inactive', () => {
    const pieces = avecPieceInactive(PIECES_INITIALES, 'piece_attenante', {
      debut: '2026-08-01',
      fin: null,
    })
    const plan = planifier(REF, 'A', historiqueVitresEnRetard('salon'), configuration({ pieces }))
    expect(plan.find((p) => p.task_definition_id === 'vitres')!.cible_resolue).toBe('bureau_madame')
  })

  it('le curseur boucle en fin de liste', () => {
    const plan = planifier(REF, 'A', historiqueVitresEnRetard('chambre_parents'), configuration())
    expect(plan.find((p) => p.task_definition_id === 'vitres')!.cible_resolue).toBe('cuisine')
  })

  it('une cible non traitée (non faite) ne fait pas avancer le curseur', () => {
    // Vitres faites au salon il y a 40 j ; la tentative suivante (pièce
    // attenante) n'a pas pu être faite : la prochaine résolution repart du
    // salon et redonne la pièce attenante.
    const historique = [
      ...historiqueVitresEnRetard('salon'),
      intervention(plusJours(REF, -3), 'A', 'cloturee', [
        instance('vitres', 'non_faite', {
          cible_resolue: 'piece_attenante',
          room_id_effectif: 'piece_attenante',
          motif_non_faite: 'manque_de_temps',
          origine: 'rotation',
        }),
      ]),
    ]
    const plan = planifier(REF, 'A', historique, configuration())
    const vitres = plan.find((p) => p.task_definition_id === 'vitres')
    expect(vitres!.cible_resolue).toBe('piece_attenante')
    expect(vitres!.reportee_depuis).toBe(plusJours(REF, -3))
  })

  it('four / micro-ondes alternent d’un trimestre à l’autre', () => {
    const base = [
      intervention(plusJours(REF, -10), 'B', 'cloturee', [
        instance('draps', 'faite'),
        instance('vitres', 'faite', { cible_resolue: 'cuisine' }),
        instance('contenants_poubelles', 'faite'),
        instance('aspiration_canape', 'faite'),
      ]),
      intervention(plusJours(REF, -30), 'A', 'cloturee', [
        instance('refrigerateur', 'faite'),
        instance('plinthes_portes', 'faite'),
        instance('lave_linge_entretien', 'faite'),
      ]),
    ]
    const apresFour = planifier(
      REF,
      'A',
      [
        ...base,
        intervention(plusJours(REF, -100), 'A', 'cloturee', [
          instance('four_micro_ondes', 'faite', { cible_resolue: 'Four' }),
        ]),
      ],
      configuration(),
    )
    const tache = apresFour.find((p) => p.task_definition_id === 'four_micro_ondes')
    expect(tache!.cible_resolue).toBe('Micro-ondes')
    expect(tache!.libelle).toBe('Intérieur du four ou du micro-ondes — Micro-ondes')

    const apresMicro = planifier(
      REF,
      'A',
      [
        ...base,
        intervention(plusJours(REF, -100), 'A', 'cloturee', [
          instance('four_micro_ondes', 'faite', { cible_resolue: 'Micro-ondes' }),
        ]),
      ],
      configuration(),
    )
    expect(apresMicro.find((p) => p.task_definition_id === 'four_micro_ondes')!.cible_resolue).toBe(
      'Four',
    )
  })
})

// ---------------------------------------------------------------------------
// Étape 4 — demandes ponctuelles
// ---------------------------------------------------------------------------

describe('étape 4 — demandes ponctuelles', () => {
  it('injectées avec l’origine ponctuelle, en fin de plan (transverses)', () => {
    const plan = planifier(
      REF,
      'A',
      historiqueCalme(),
      configuration({
        demandes_en_attente: [{ id: 'd1', texte: 'Arroser les plantes du balcon' }],
      }),
    )
    const ponctuelle = plan.find((p) => p.demande_ponctuelle_id === 'd1')
    expect(ponctuelle).toBeDefined()
    expect(ponctuelle!.origine).toBe('ponctuelle')
    expect(ponctuelle!.libelle).toBe('Arroser les plantes du balcon')
    expect(ponctuelle!.task_definition_id).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Étape 5 — repêchage
// ---------------------------------------------------------------------------

describe('étape 5 — repêchage', () => {
  it('une tâche de passage non faite (manque de temps) est réinjectée sur le passage suivant, avec bandeau', () => {
    const historique = [
      ...historiqueCalme(),
      intervention('2026-08-28', 'A', 'cloturee', [
        instance('salle_de_bain_complet', 'partielle', {
          motif_non_faite: 'manque_de_temps',
          room_id_effectif: 'salle_de_bain',
        }),
      ]),
    ]
    const plan = planifier(REF, 'B', historique, configuration())
    const reportee = plan.find((p) => p.task_definition_id === 'salle_de_bain_complet')
    expect(reportee).toBeDefined()
    expect(reportee!.reportee_depuis).toBe('2026-08-28')
    expect(reportee!.room_id_effectif).toBe('salle_de_bain')
  })

  it('les motifs hors temps/accès ne déclenchent pas de repêchage', () => {
    const historique = [
      ...historiqueCalme(),
      intervention('2026-08-28', 'A', 'cloturee', [
        instance('salle_de_bain_complet', 'non_faite', { motif_non_faite: 'non_necessaire' }),
        instance('bureau_madame_entretien', 'non_faite', { motif_non_faite: null }),
      ]),
    ]
    const plan = planifier(REF, 'B', historique, configuration())
    expect(ids(plan)).not.toContain('salle_de_bain_complet')
    expect(ids(plan)).not.toContain('bureau_madame_entretien')
  })

  it('une tâche déjà au socle du jour n’est pas dupliquée : elle porte seulement le bandeau', () => {
    const historique = [
      ...historiqueCalme(),
      intervention('2026-08-28', 'A', 'cloturee', [
        instance('poubelles', 'non_faite', { motif_non_faite: 'manque_de_temps' }),
      ]),
    ]
    const plan = planifier(REF, 'B', historique, configuration())
    const occurrences = plan.filter((p) => p.task_definition_id === 'poubelles')
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0]!.reportee_depuis).toBe('2026-08-28')
  })

  it('le repêchage lit la dernière intervention clôturée, en ignorant une annulée intercalée', () => {
    const historique = [
      ...historiqueCalme(),
      intervention('2026-08-25', 'A', 'cloturee', [
        instance('salle_de_bain_complet', 'non_faite', { motif_non_faite: 'piece_inaccessible' }),
      ]),
      intervention('2026-08-28', 'B', 'annulee'),
    ]
    const plan = planifier(REF, 'B', historique, configuration())
    expect(plan.find((p) => p.task_definition_id === 'salle_de_bain_complet')!.reportee_depuis).toBe(
      '2026-08-25',
    )
  })

  it('une demande ponctuelle non faite est réinjectée avec son libellé d’origine', () => {
    const historique = [
      ...historiqueCalme(),
      intervention('2026-08-28', 'A', 'cloturee', [
        instance(null, 'non_faite', {
          demande_ponctuelle_id: 'd9',
          libelle: 'Nettoyer le tapis du couloir',
          motif_non_faite: 'piece_inaccessible',
          origine: 'ponctuelle',
        }),
      ]),
    ]
    const plan = planifier(REF, 'B', historique, configuration())
    const reportee = plan.find((p) => p.demande_ponctuelle_id === 'd9')
    expect(reportee).toBeDefined()
    expect(reportee!.origine).toBe('ponctuelle')
    expect(reportee!.libelle).toBe('Nettoyer le tapis du couloir')
    expect(reportee!.reportee_depuis).toBe('2026-08-28')
  })

  it('une rotative reportée repasse par la sélection avec +0.5, sans doublon', () => {
    const base = [
      intervention(plusJours(REF, -30), 'A', 'cloturee', [
        instance('four_micro_ondes', 'faite', { cible_resolue: 'Four' }),
        instance('refrigerateur', 'faite'),
        instance('plinthes_portes', 'faite'),
        instance('lave_linge_entretien', 'faite'),
      ]),
      intervention(plusJours(REF, -20), 'B', 'cloturee', [
        instance('draps', 'faite'),
        instance('vitres', 'faite', { cible_resolue: 'cuisine' }),
        instance('contenants_poubelles', 'faite'),
        instance('aspiration_canape', 'faite'),
      ]),
    ]
    // Sans report : r = 20/30 ≈ 0.67, sous le seuil — pas sélectionnée.
    const sans = planifier(REF, 'A', base, configuration())
    expect(ids(sans)).not.toContain('aspiration_canape')

    // Avec un report (non faite, manque de temps) : r ≈ 1.17 — sélectionnée,
    // une seule fois, avec le bandeau.
    const avec = planifier(
      REF,
      'A',
      [
        ...base,
        intervention(plusJours(REF, -3), 'A', 'cloturee', [
          instance('aspiration_canape', 'non_faite', {
            motif_non_faite: 'manque_de_temps',
            origine: 'rotation',
          }),
        ]),
      ],
      configuration(),
    )
    const occurrences = avec.filter((p) => p.task_definition_id === 'aspiration_canape')
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0]!.origine).toBe('rotation')
    expect(occurrences[0]!.reportee_depuis).toBe(plusJours(REF, -3))
  })
})

// ---------------------------------------------------------------------------
// Étape 6 — ordonnancement et volumétrie
// ---------------------------------------------------------------------------

describe('étape 6 — ordonnancement', () => {
  it('groupe par pièce dans l’ordre d’affichage, transverses en fin', () => {
    const plan = planifier(
      REF,
      'A',
      historiqueCalme(),
      configuration({ demandes_en_attente: [{ id: 'd1', texte: 'Plantes' }] }),
    )
    const ordres = new Map(PIECES_INITIALES.map((p) => [p.id, p.ordre_affichage]))
    const rangs = plan.map((p) =>
      p.room_id_effectif === null ? Number.MAX_SAFE_INTEGER : ordres.get(p.room_id_effectif)!,
    )
    expect([...rangs].sort((a, b) => a - b)).toEqual(rangs)
    // La cuisine ouvre le plan, les transverses le ferment.
    expect(plan[0]!.room_id_effectif).toBe('cuisine')
    expect(plan.at(-1)!.room_id_effectif).toBeNull()
    const transverses = plan.filter((p) => p.room_id_effectif === null)
    expect(ids(transverses)).toContain('linge')
    expect(ids(transverses)).toContain('poubelles')
  })

  it('volumétrie en régime établi : au plus 12 cartes de pièce et une rotative', () => {
    for (const type of ['A', 'B'] as const) {
      const plan = planifier(REF, type, historiqueCalme(), configuration())
      const cartes = new Set(plan.map((p) => p.room_id_effectif ?? '__transverse__'))
      expect(cartes.size).toBeLessThanOrEqual(12)
      expect(rotatives(plan).length).toBeLessThanOrEqual(1)
    }
  })
})

// ---------------------------------------------------------------------------
// Reprise après une longue absence (SPEC §8)
// ---------------------------------------------------------------------------

describe('reprise après trois semaines d’absence', () => {
  it('les plus en retard passent en premier, le plafond reste respecté', () => {
    // Dernières exécutions étalées, puis plus rien pendant trois semaines.
    const historique = [
      intervention('2026-06-15', 'A', 'cloturee', [
        instance('four_micro_ondes', 'faite', { cible_resolue: 'Four' }),
      ]),
      intervention('2026-07-01', 'B', 'cloturee', [instance('refrigerateur', 'faite')]),
      intervention('2026-07-20', 'B', 'cloturee', [instance('draps', 'faite')]),
      intervention('2026-07-25', 'A', 'cloturee', [
        instance('vitres', 'faite', { cible_resolue: 'cuisine' }),
      ]),
      intervention('2026-08-01', 'B', 'cloturee', [instance('contenants_poubelles', 'faite')]),
      intervention('2026-08-05', 'A', 'cloturee', [instance('plinthes_portes', 'faite')]),
      intervention('2026-08-08', 'B', 'cloturee', [instance('aspiration_canape', 'faite')]),
      intervention('2026-08-10', 'A', 'cloturee', [instance('lave_linge_entretien', 'faite')]),
    ]
    // r : draps 1.43, vitres 1.27, contenants 1.03 (3 en retard, pas plus de 3)
    // → plafond à 1, la plus en retard d'abord.
    const plan = planifier(REF, 'B', historique, configuration())
    expect(ids(rotatives(plan))).toEqual(['draps'])

    // Le passage suivant récupère la suivante (vitres), toujours une à la fois.
    const suite = [
      ...historique,
      intervention(REF, 'B', 'cloturee', [instance('draps', 'faite')]),
    ]
    const planSuivant = planifier(plusJours(REF, 3), 'A', suite, configuration())
    expect(ids(rotatives(planSuivant))).toEqual(['vitres'])
  })
})
