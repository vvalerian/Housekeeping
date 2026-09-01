/**
 * Test d'intégration léger (SPEC §8) : base SQLite en mémoire, seed réel,
 * scénario de bout en bout via l'API. Les étapes s'enchaînent volontairement :
 * chaque `it` prolonge l'état laissé par le précédent.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { creerApp } from './app.js'
import { ouvrirBase, type Db } from './db/client.js'
import { chargerCatalogue } from './db/seed.js'

interface Reponse {
  statut: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  corps: any
}

let db: Db
let appel: (methode: string, chemin: string, corps?: unknown) => Promise<Reponse>

beforeAll(() => {
  db = ouvrirBase(':memory:')
  chargerCatalogue(db)
  const app = creerApp(db)
  appel = async (methode, chemin, corps) => {
    const reponse = await app.request(chemin, {
      method: methode,
      ...(corps !== undefined
        ? { body: JSON.stringify(corps), headers: { 'content-type': 'application/json' } }
        : {}),
    })
    return { statut: reponse.status, corps: await reponse.json().catch(() => null) }
  }
})

// 2026-09-01 est un mardi ; jours d'intervention par défaut : mardi et vendredi.
describe('API — scénario de bout en bout', () => {
  let idMardi = ''
  let idInstancePoubelles = ''
  let idInstanceVitres = ''

  it('expose le catalogue chargé par le seed, travaux compris', async () => {
    const pieces = await appel('GET', '/api/pieces')
    expect(pieces.statut).toBe(200)
    expect(pieces.corps).toHaveLength(15)
    const salon = pieces.corps.find((p: { id: string }) => p.id === 'salon')
    expect(salon.periodes_inactivite).toEqual([
      { debut: '2026-08-01', fin: null, motif: expect.stringContaining('Travaux') },
    ])
    const taches = await appel('GET', '/api/taches')
    expect(taches.corps).toHaveLength(25) // 5 + 6 + 6 + 4 + 4 (SPEC §4)
  })

  it('génère le calendrier en alternance stricte A/B', async () => {
    const reponse = await appel('POST', '/api/calendrier/generer', {
      depuis: '2026-09-01',
      jusqua: '2026-09-11',
    })
    expect(reponse.statut).toBe(201)
    expect(
      reponse.corps.map((i: { date: string; type: string }) => [i.date, i.type]),
    ).toEqual([
      ['2026-09-01', 'A'],
      ['2026-09-04', 'B'],
      ['2026-09-08', 'A'],
      ['2026-09-11', 'B'],
    ])
    // Relancer la génération sur la même fenêtre ne crée pas de doublon.
    const rejouee = await appel('POST', '/api/calendrier/generer', {
      depuis: '2026-09-01',
      jusqua: '2026-09-11',
    })
    expect(rejouee.corps).toHaveLength(0)
  })

  it('sert le plan du jour de la tablette, généré à la première consultation', async () => {
    const reponse = await appel('GET', '/api/interventions/du-jour?date=2026-09-01')
    expect(reponse.statut).toBe(200)
    expect(reponse.corps.intervention.type).toBe('A')
    idMardi = reponse.corps.intervention.id

    const instances: {
      id: string
      task_definition_id: string | null
      origine: string
      cible_resolue: string | null
    }[] = reponse.corps.instances
    const parDef = (defId: string) => instances.find((i) => i.task_definition_id === defId)

    // Socle du passage A.
    for (const attendu of ['cuisine_nettoyage', 'salle_de_bain_complet', 'poubelles', 'linge']) {
      expect(parDef(attendu), attendu).toBeDefined()
    }
    // Pièces condamnées par les travaux : le canapé (pièce attenante) est
    // écarté, la rotation des vitres saute salon et pièce attenante.
    expect(parDef('aspiration_canape')).toBeUndefined()
    const vitres = parDef('vitres')
    expect(vitres).toBeDefined()
    expect(vitres!.cible_resolue).toBe('cuisine')
    idInstanceVitres = vitres!.id
    idInstancePoubelles = parDef('poubelles')!.id

    // Une seconde consultation ne régénère rien.
    const relecture = await appel('GET', '/api/interventions/du-jour?date=2026-09-01')
    expect(relecture.corps.instances).toHaveLength(instances.length)
  })

  it('une demande ponctuelle arrivée après la génération rejoint le plan', async () => {
    const creation = await appel('POST', '/api/demandes', {
      texte: 'Nettoyer la cage du hamster',
    })
    expect(creation.statut).toBe(201)
    const plan = await appel('GET', '/api/interventions/du-jour?date=2026-09-01')
    const ponctuelle = plan.corps.instances.find(
      (i: { origine: string }) => i.origine === 'ponctuelle',
    )
    expect(ponctuelle.libelle).toBe('Nettoyer la cage du hamster')
    const injectees = await appel('GET', '/api/demandes?statut=injectee')
    expect(injectees.corps).toHaveLength(1)
  })

  it('démarrage, validation des tâches puis clôture', async () => {
    const demarrage = await appel('POST', `/api/interventions/${idMardi}/demarrer`)
    expect(demarrage.corps.intervention.statut).toBe('en_cours')
    expect(demarrage.corps.intervention.heure_debut).not.toBeNull()

    const vitresFaites = await appel('PATCH', `/api/instances/${idInstanceVitres}`, {
      statut: 'faite',
    })
    expect(vitresFaites.corps.statut).toBe('faite')
    expect(vitresFaites.corps.horodatage_validation).not.toBeNull()

    const poubellesReportees = await appel('PATCH', `/api/instances/${idInstancePoubelles}`, {
      statut: 'non_faite',
      motif_non_faite: 'manque_de_temps',
      commentaire: 'Local à poubelles inaccessible en fin de créneau',
    })
    expect(poubellesReportees.corps.motif_non_faite).toBe('manque_de_temps')

    const cloture = await appel('POST', `/api/interventions/${idMardi}/cloturer`, {
      note_intervenante: 'RAS, produit sol bientôt fini',
    })
    expect(cloture.statut).toBe(200)
    expect(cloture.corps.intervention.statut).toBe('cloturee')
    // Les tâches restées à faire passent à non_faite sans motif (non repêchées).
    const restantes = cloture.corps.instances.filter(
      (i: { statut: string }) => i.statut === 'a_faire',
    )
    expect(restantes).toHaveLength(0)
    const sansMotif = cloture.corps.instances.find(
      (i: { task_definition_id: string | null }) => i.task_definition_id === 'cuisine_nettoyage',
    )
    expect(sansMotif.statut).toBe('non_faite')
    expect(sansMotif.motif_non_faite).toBeNull()
  })

  it('le vendredi hérite du repêchage, pas des tâches sans motif', async () => {
    const reponse = await appel('GET', '/api/interventions/du-jour?date=2026-09-04')
    expect(reponse.corps.intervention.type).toBe('B')
    const instances: {
      task_definition_id: string | null
      origine: string
      reportee_depuis: string | null
      libelle: string
    }[] = reponse.corps.instances

    const poubelles = instances.filter((i) => i.task_definition_id === 'poubelles')
    expect(poubelles).toHaveLength(1)
    expect(poubelles[0]!.reportee_depuis).toBe('2026-09-01')

    // Non faite sans motif → pas de bandeau ; demande déjà injectée → pas de retour.
    const cuisine = instances.find((i) => i.task_definition_id === 'cuisine_nettoyage')
    expect(cuisine!.reportee_depuis).toBeNull()
    expect(instances.some((i) => i.libelle.includes('hamster'))).toBe(false)

    // Les draps (contraints au passage B, jamais faits) font partie des rotatives.
    const rotation = instances.filter((i) => i.origine === 'rotation')
    expect(rotation.map((i) => i.task_definition_id)).toContain('draps')
  })

  it('la vue rotations donne la dernière exécution de chaque tournante', async () => {
    const reponse = await appel('GET', '/api/rotations/etat?date=2026-09-04')
    expect(reponse.statut).toBe(200)
    const parId = new Map(
      reponse.corps.map((l: { task_definition_id: string }) => [l.task_definition_id, l]),
    )
    const vitres = parId.get('vitres') as {
      derniere_execution: string
      derniere_cible: string
      jours_depuis: number
    }
    expect(vitres.derniere_execution).toBe('2026-09-01')
    expect(vitres.derniere_cible).toBe('cuisine')
    expect(vitres.jours_depuis).toBe(3)
    expect((parId.get('refrigerateur') as { jamais_executee: boolean }).jamais_executee).toBe(true)
  })

  it('annulation d’une intervention exceptionnelle', async () => {
    const creation = await appel('POST', '/api/interventions', {
      date: '2026-09-06',
      type: 'exceptionnelle',
    })
    expect(creation.statut).toBe(201)
    const annulation = await appel('POST', `/api/interventions/${creation.corps.id}/annuler`)
    expect(annulation.corps.statut).toBe('annulee')
  })

  it('signalements, consommables et messages', async () => {
    const signalement = await appel('POST', '/api/signalements', {
      type: 'produit_a_racheter',
      texte: 'Produit pour les sols presque vide',
    })
    expect(signalement.statut).toBe(201)
    const traite = await appel('PATCH', `/api/signalements/${signalement.corps.id}`, {
      statut: 'traite',
      reponse_employeur: 'Commandé, livraison jeudi',
    })
    expect(traite.corps.statut).toBe('traite')

    const produit = await appel('POST', '/api/produits', { nom: 'Produit sols' })
    const niveau = await appel('PATCH', `/api/produits/${produit.corps.id}`, { niveau: 'bas' })
    expect(niveau.corps.niveau).toBe('bas')

    await appel('POST', '/api/messages', {
      auteur: 'employeur',
      texte: 'Merci pour vendredi, bonne semaine !',
    })
    const messages = await appel('GET', '/api/messages')
    expect(messages.corps).toHaveLength(1)
  })

  it('mode travaux d’un clic puis réactivation', async () => {
    const travaux = await appel('POST', '/api/pieces/mode-travaux', {
      piece_ids: ['bureau_madame'],
      debut: '2026-10-01',
      fin: '2026-10-15',
      motif: 'Peinture',
    })
    expect(travaux.statut).toBe(200)
    const reactivation = await appel('POST', '/api/pieces/bureau_madame/reactiver', {
      fin: '2026-10-05',
    })
    expect(reactivation.statut).toBe(200)
    expect(
      reactivation.corps.periodes_inactivite.every((p: { fin: string | null }) => p.fin !== null),
    ).toBe(true)

    const corpsInvalide = await appel('POST', '/api/pieces/mode-travaux', {
      piece_ids: [],
      debut: 'pas-une-date',
    })
    expect(corpsInvalide.statut).toBe(400)
  })
})
