/**
 * Test d'intégration léger (SPEC §8) : base SQLite en mémoire, seed réel,
 * scénario de bout en bout via l'API — authentification comprise (lot 3).
 * Les étapes s'enchaînent volontairement : chaque `it` prolonge l'état laissé
 * par le précédent.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { creerApp } from './app.js'
import { ouvrirBase, type Db } from './db/client.js'
import { reinitialiserMotDePasse } from './db/mot-de-passe.js'
import { chargerCatalogue } from './db/seed.js'

interface Reponse {
  statut: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  corps: any
}

type Client = (methode: string, chemin: string, corps?: unknown) => Promise<Reponse>

let db: Db
/** Client authentifié employeur (cookie posé par le scénario d'initialisation). */
let employeur: Client
/** Client de la tablette (cookie posé par la connexion PIN). */
let tablette: Client
/** Client sans session. */
let anonyme: Client

beforeAll(() => {
  db = ouvrirBase(':memory:')
  chargerCatalogue(db)
  const app = creerApp(db)

  // Petit client HTTP à pot de cookies : chaque client garde sa session.
  const creerClient = (): Client => {
    let cookie: string | null = null
    return async (methode, chemin, corps) => {
      const reponse = await app.request(chemin, {
        method: methode,
        headers: {
          ...(corps !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(cookie !== null ? { cookie } : {}),
        },
        ...(corps !== undefined ? { body: JSON.stringify(corps) } : {}),
      })
      const posee = reponse.headers.get('set-cookie')
      if (posee !== null) cookie = posee.split(';')[0]!
      return { statut: reponse.status, corps: await reponse.json().catch(() => null) }
    }
  }
  employeur = creerClient()
  tablette = creerClient()
  anonyme = creerClient()
})

// Jours d'intervention du foyer : lundi et jeudi. Dans la fenêtre testée,
// 2026-09-03 est un jeudi et 2026-09-07 un lundi.
describe('API — scénario de bout en bout', () => {
  let idJeudi = ''
  let idInstancePoubelles = ''
  let idInstanceVitres = ''

  it('tout est fermé sans session, sauf la santé et l’état d’authentification', async () => {
    expect((await anonyme('GET', '/api/sante')).statut).toBe(200)
    expect((await anonyme('GET', '/api/pieces')).statut).toBe(401)
    expect((await anonyme('GET', '/api/interventions/du-jour')).statut).toBe(401)
    const etat = await anonyme('GET', '/api/auth/etat')
    expect(etat.corps).toEqual({ initialisation_requise: true, acteur: null, pin: 'non_configure' })
  })

  it('initialisation du premier compte employeur, une seule fois', async () => {
    const creation = await employeur('POST', '/api/auth/initialisation', {
      identifiant: 'valerian',
      mot_de_passe: 'tres-long-secret',
    })
    expect(creation.statut).toBe(201)
    const rejouee = await anonyme('POST', '/api/auth/initialisation', {
      identifiant: 'intrus',
      mot_de_passe: 'nimportequoi',
    })
    expect(rejouee.statut).toBe(403)
    const etat = await employeur('GET', '/api/auth/etat')
    expect(etat.corps.acteur).toBe('employeur')
    expect(etat.corps.initialisation_requise).toBe(false)
  })

  it('connexion classique : mauvais mot de passe refusé, bon accepté', async () => {
    const echec = await anonyme('POST', '/api/auth/connexion', {
      identifiant: 'valerian',
      mot_de_passe: 'faux',
    })
    expect(echec.statut).toBe(401)
    const succes = await anonyme('POST', '/api/auth/connexion', {
      identifiant: 'valerian',
      mot_de_passe: 'tres-long-secret',
    })
    expect(succes.statut).toBe(200)
    await anonyme('POST', '/api/auth/deconnexion')
    expect((await anonyme('GET', '/api/pieces')).statut).toBe(401)
  })

  it('PIN tablette : bloqué tant que non configuré, puis session longue', async () => {
    expect((await tablette('POST', '/api/auth/pin', { pin: '1234' })).statut).toBe(403)
    // La configuration du PIN est réservée aux employeurs.
    expect((await tablette('POST', '/api/auth/pin-tablette', { pin: '4321' })).statut).toBe(401)
    expect(
      (await employeur('POST', '/api/auth/pin-tablette', { pin: '4321' })).corps.pin,
    ).toBe('requis')
    expect((await tablette('POST', '/api/auth/pin', { pin: '0000' })).statut).toBe(401)
    expect((await tablette('POST', '/api/auth/pin', { pin: '4321' })).statut).toBe(200)
    const etat = await tablette('GET', '/api/auth/etat')
    expect(etat.corps.acteur).toBe('tablette')
  })

  it('la session tablette lit le plan mais ne touche pas à la configuration', async () => {
    expect((await tablette('GET', '/api/pieces')).statut).toBe(200)
    expect((await tablette('POST', '/api/pieces', { nom: 'Cave', type: 'circulation' })).statut).toBe(
      403,
    )
    expect(
      (await tablette('POST', '/api/calendrier/generer', { depuis: '2026-09-01', jusqua: '2026-09-11' }))
        .statut,
    ).toBe(403)
  })

  it('expose le catalogue chargé par le seed, travaux compris', async () => {
    const pieces = await employeur('GET', '/api/pieces')
    expect(pieces.statut).toBe(200)
    expect(pieces.corps).toHaveLength(15)
    for (const id of ['salle_a_manger', 'salon']) {
      const piece = pieces.corps.find((p: { id: string }) => p.id === id)
      expect(piece.periodes_inactivite, id).toEqual([
        { debut: '2026-08-01', fin: null, motif: expect.stringContaining('Travaux') },
      ])
    }
    const taches = await employeur('GET', '/api/taches')
    expect(taches.corps).toHaveLength(25) // 5 + 6 + 6 + 4 + 4 (SPEC §4)
  })

  it('génère le calendrier en alternance stricte A/B', async () => {
    const reponse = await employeur('POST', '/api/calendrier/generer', {
      depuis: '2026-09-01',
      jusqua: '2026-09-11',
    })
    expect(reponse.statut).toBe(201)
    expect(
      reponse.corps.map((i: { date: string; type: string }) => [i.date, i.type]),
    ).toEqual([
      ['2026-09-03', 'A'],
      ['2026-09-07', 'B'],
      ['2026-09-10', 'A'],
    ])
    // Relancer la génération sur la même fenêtre ne crée pas de doublon.
    const rejouee = await employeur('POST', '/api/calendrier/generer', {
      depuis: '2026-09-01',
      jusqua: '2026-09-11',
    })
    expect(rejouee.corps).toHaveLength(0)
  })

  it('sert le plan du jour de la tablette, généré à la première consultation', async () => {
    const reponse = await tablette('GET', '/api/interventions/du-jour?date=2026-09-03')
    expect(reponse.statut).toBe(200)
    expect(reponse.corps.intervention.type).toBe('A')
    idJeudi = reponse.corps.intervention.id

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
    // Pièces condamnées par les travaux : le canapé (salon) est écarté, la
    // rotation des vitres saute la salle à manger et le salon.
    expect(parDef('aspiration_canape')).toBeUndefined()
    const vitres = parDef('vitres')
    expect(vitres).toBeDefined()
    expect(vitres!.cible_resolue).toBe('cuisine')
    idInstanceVitres = vitres!.id
    idInstancePoubelles = parDef('poubelles')!.id

    // Une seconde consultation ne régénère rien.
    const relecture = await tablette('GET', '/api/interventions/du-jour?date=2026-09-03')
    expect(relecture.corps.instances).toHaveLength(instances.length)
  })

  it('une demande ponctuelle arrivée après la génération rejoint le plan', async () => {
    const creation = await employeur('POST', '/api/demandes', {
      texte: 'Nettoyer la cage du hamster',
    })
    expect(creation.statut).toBe(201)
    const plan = await tablette('GET', '/api/interventions/du-jour?date=2026-09-03')
    const ponctuelle = plan.corps.instances.find(
      (i: { origine: string }) => i.origine === 'ponctuelle',
    )
    expect(ponctuelle.libelle).toBe('Nettoyer la cage du hamster')
    const injectees = await employeur('GET', '/api/demandes?statut=injectee')
    expect(injectees.corps).toHaveLength(1)
  })

  it('démarrage, validation des tâches puis clôture, depuis la tablette', async () => {
    const demarrage = await tablette('POST', `/api/interventions/${idJeudi}/demarrer`)
    expect(demarrage.corps.intervention.statut).toBe('en_cours')
    expect(demarrage.corps.intervention.heure_debut).not.toBeNull()

    const vitresFaites = await tablette('PATCH', `/api/instances/${idInstanceVitres}`, {
      statut: 'faite',
    })
    expect(vitresFaites.corps.statut).toBe('faite')
    expect(vitresFaites.corps.horodatage_validation).not.toBeNull()

    const poubellesReportees = await tablette('PATCH', `/api/instances/${idInstancePoubelles}`, {
      statut: 'non_faite',
      motif_non_faite: 'manque_de_temps',
      commentaire: 'Local à poubelles inaccessible en fin de créneau',
    })
    expect(poubellesReportees.corps.motif_non_faite).toBe('manque_de_temps')

    const cloture = await tablette('POST', `/api/interventions/${idJeudi}/cloturer`, {
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

  it('le lundi suivant hérite du repêchage, pas des tâches sans motif', async () => {
    const reponse = await tablette('GET', '/api/interventions/du-jour?date=2026-09-07')
    expect(reponse.corps.intervention.type).toBe('B')
    const instances: {
      task_definition_id: string | null
      origine: string
      reportee_depuis: string | null
      libelle: string
    }[] = reponse.corps.instances

    const poubelles = instances.filter((i) => i.task_definition_id === 'poubelles')
    expect(poubelles).toHaveLength(1)
    expect(poubelles[0]!.reportee_depuis).toBe('2026-09-03')

    // Non faite sans motif → pas de bandeau ; demande déjà injectée → pas de retour.
    const cuisine = instances.find((i) => i.task_definition_id === 'cuisine_nettoyage')
    expect(cuisine!.reportee_depuis).toBeNull()
    expect(instances.some((i) => i.libelle.includes('hamster'))).toBe(false)

    // Les draps (contraints au passage B, jamais faits) font partie des rotatives.
    const rotation = instances.filter((i) => i.origine === 'rotation')
    expect(rotation.map((i) => i.task_definition_id)).toContain('draps')
  })

  it('la vue rotations donne la dernière exécution de chaque tournante', async () => {
    const reponse = await employeur('GET', '/api/rotations/etat?date=2026-09-07')
    expect(reponse.statut).toBe(200)
    const parId = new Map(
      reponse.corps.map((l: { task_definition_id: string }) => [l.task_definition_id, l]),
    )
    const vitres = parId.get('vitres') as {
      derniere_execution: string
      derniere_cible: string
      jours_depuis: number
    }
    expect(vitres.derniere_execution).toBe('2026-09-03')
    expect(vitres.derniere_cible).toBe('cuisine')
    expect(vitres.jours_depuis).toBe(4)
    expect((parId.get('refrigerateur') as { jamais_executee: boolean }).jamais_executee).toBe(true)
  })

  it('annulation d’une intervention exceptionnelle', async () => {
    const creation = await employeur('POST', '/api/interventions', {
      date: '2026-09-06',
      type: 'exceptionnelle',
    })
    expect(creation.statut).toBe(201)
    const annulation = await employeur('POST', `/api/interventions/${creation.corps.id}/annuler`)
    expect(annulation.corps.statut).toBe('annulee')
  })

  it('signalements, consommables et messages', async () => {
    const signalement = await tablette('POST', '/api/signalements', {
      type: 'produit_a_racheter',
      texte: 'Produit pour les sols presque vide',
    })
    expect(signalement.statut).toBe(201)
    // La réponse est réservée aux employeurs.
    expect(
      (await tablette('PATCH', `/api/signalements/${signalement.corps.id}`, { statut: 'traite' }))
        .statut,
    ).toBe(403)
    const traite = await employeur('PATCH', `/api/signalements/${signalement.corps.id}`, {
      statut: 'traite',
      reponse_employeur: 'Commandé, livraison jeudi',
    })
    expect(traite.corps.statut).toBe('traite')

    const produit = await employeur('POST', '/api/produits', { nom: 'Produit sols' })
    // La tablette met le niveau à jour d'une touche (SPEC §3.5).
    const niveau = await tablette('PATCH', `/api/produits/${produit.corps.id}`, { niveau: 'bas' })
    expect(niveau.corps.niveau).toBe('bas')

    await employeur('POST', '/api/messages', {
      auteur: 'employeur',
      texte: 'Merci pour vendredi, bonne semaine !',
    })
    const messages = await tablette('GET', '/api/messages')
    expect(messages.corps).toHaveLength(1)
  })

  it('mode travaux d’un clic puis réactivation', async () => {
    const travaux = await employeur('POST', '/api/pieces/mode-travaux', {
      piece_ids: ['atelier'],
      debut: '2026-10-01',
      fin: '2026-10-15',
      motif: 'Peinture',
    })
    expect(travaux.statut).toBe(200)
    const reactivation = await employeur('POST', '/api/pieces/atelier/reactiver', {
      fin: '2026-10-05',
    })
    expect(reactivation.statut).toBe(200)
    expect(
      reactivation.corps.periodes_inactivite.every((p: { fin: string | null }) => p.fin !== null),
    ).toBe(true)

    const corpsInvalide = await employeur('POST', '/api/pieces/mode-travaux', {
      piece_ids: [],
      debut: 'pas-une-date',
    })
    expect(corpsInvalide.statut).toBe(400)
  })

  it('désactivation explicite du PIN : la tablette entre sans code', async () => {
    expect((await employeur('POST', '/api/auth/pin-tablette', { pin: null })).corps.pin).toBe(
      'desactive',
    )
    const nouvelle = await anonyme('POST', '/api/auth/pin', {})
    expect(nouvelle.statut).toBe(200)
    expect((await anonyme('GET', '/api/auth/etat')).corps.acteur).toBe('tablette')
  })

  it('mot de passe réinitialisé côté serveur : sessions fermées, nouveau secret seul accepté', async () => {
    expect(reinitialiserMotDePasse(db, 'inconnu', 'peu-importe-ici')).toBe(false)
    expect(reinitialiserMotDePasse(db, 'valerian', 'nouveau-secret')).toBe(true)
    expect((await employeur('GET', '/api/auth/comptes')).statut).toBe(401)
    const ancien = await anonyme('POST', '/api/auth/connexion', {
      identifiant: 'valerian',
      mot_de_passe: 'tres-long-secret',
    })
    expect(ancien.statut).toBe(401)
    const nouveau = await anonyme('POST', '/api/auth/connexion', {
      identifiant: 'valerian',
      mot_de_passe: 'nouveau-secret',
    })
    expect(nouveau.statut).toBe(200)
  })
})
