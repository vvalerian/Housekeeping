/**
 * Endpoints d'authentification. Publics : etat, initialisation (tant qu'aucun
 * compte n'existe), connexion, pin, deconnexion. Réservés aux employeurs :
 * configuration du PIN tablette et gestion des comptes.
 */
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  acteurDeLaRequete,
  authentification,
  CLE_PIN,
  creerSession,
  detruireSession,
  ecrireParametre,
  effacerEchecs,
  estVerrouille,
  exigerEmployeur,
  hacher,
  lireParametre,
  noterEchec,
  PIN_DESACTIVE,
  verifierSecret,
} from '../auth.js'
import type { Db } from '../db/client.js'
import * as schema from '../db/schema.js'
import { lireCorps, maintenant } from '../http.js'

const CreationCompteSchema = z.object({
  identifiant: z.string().min(3).max(64),
  mot_de_passe: z.string().min(8).max(256),
})

const ConnexionSchema = z.object({
  identifiant: z.string().min(1).max(64),
  mot_de_passe: z.string().min(1).max(256),
})

const PinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/).optional(),
})

const ConfigurationPinSchema = z.object({
  /** `null` = désactiver le PIN (accès tablette sans code, choix explicite). */
  pin: z.string().regex(/^\d{4}$/).nullable(),
})

export function routesAuth(db: Db): Hono {
  const routes = new Hono()
  const reserveEmployeur = [authentification(db), exigerEmployeur] as const

  const nbComptes = () => db.select().from(schema.comptesEmployeurs).all().length
  const etatPin = () => {
    const valeur = lireParametre(db, CLE_PIN)
    return valeur === null ? 'non_configure' : valeur === PIN_DESACTIVE ? 'desactive' : 'requis'
  }

  /** État public : qui suis-je, faut-il initialiser, le PIN est-il requis ? */
  routes.get('/etat', (c) => {
    const acteur = acteurDeLaRequete(db, c)
    return c.json({
      initialisation_requise: nbComptes() === 0,
      acteur: acteur?.type ?? null,
      pin: etatPin(),
    })
  })

  // Création du tout premier compte employeur (écran d'initialisation). En
  // production, la fenêtre est couverte par le Basic Auth nginx — cf.
  // deploy/README.md, à retirer seulement après cette étape.
  routes.post('/initialisation', async (c) => {
    const corps = await lireCorps(c, CreationCompteSchema)
    if (corps instanceof Response) return corps
    if (nbComptes() > 0) {
      return c.json({ erreur: 'Un compte existe déjà — utiliser la connexion' }, 403)
    }
    const compte = {
      id: randomUUID(),
      identifiant: corps.identifiant,
      mot_de_passe_hash: hacher(corps.mot_de_passe),
      cree_le: maintenant(),
    }
    db.insert(schema.comptesEmployeurs).values(compte).run()
    creerSession(db, c, 'employeur', compte.id)
    return c.json({ identifiant: compte.identifiant }, 201)
  })

  routes.post('/connexion', async (c) => {
    const corps = await lireCorps(c, ConnexionSchema)
    if (corps instanceof Response) return corps
    const cleVerrou = `compte:${corps.identifiant}`
    if (estVerrouille(cleVerrou)) {
      return c.json({ erreur: 'Trop de tentatives — réessayer dans quelques minutes' }, 429)
    }
    const compte = db
      .select()
      .from(schema.comptesEmployeurs)
      .where(eq(schema.comptesEmployeurs.identifiant, corps.identifiant))
      .get()
    if (compte === undefined || !verifierSecret(corps.mot_de_passe, compte.mot_de_passe_hash)) {
      noterEchec(cleVerrou)
      return c.json({ erreur: 'Identifiant ou mot de passe incorrect' }, 401)
    }
    effacerEchecs(cleVerrou)
    creerSession(db, c, 'employeur', compte.id)
    return c.json({ identifiant: compte.identifiant })
  })

  routes.post('/deconnexion', (c) => {
    detruireSession(db, c)
    return c.json({ ok: true })
  })

  /** Ouverture de session tablette : PIN à 4 chiffres, ou rien s'il est désactivé. */
  routes.post('/pin', async (c) => {
    const corps = await lireCorps(c, PinSchema)
    if (corps instanceof Response) return corps
    const etat = etatPin()
    if (etat === 'non_configure') {
      return c.json(
        { erreur: 'PIN non configuré — à définir depuis l’espace employeur (Sécurité)' },
        403,
      )
    }
    if (etat === 'desactive') {
      creerSession(db, c, 'tablette', null)
      return c.json({ ok: true })
    }
    if (estVerrouille('pin')) {
      return c.json({ erreur: 'Trop de tentatives — réessayer dans quelques minutes' }, 429)
    }
    const hash = lireParametre(db, CLE_PIN)!
    if (corps.pin === undefined || !verifierSecret(corps.pin, hash)) {
      noterEchec('pin')
      return c.json({ erreur: 'Code incorrect' }, 401)
    }
    effacerEchecs('pin')
    creerSession(db, c, 'tablette', null)
    return c.json({ ok: true })
  })

  routes.post('/pin-tablette', ...reserveEmployeur, async (c) => {
    const corps = await lireCorps(c, ConfigurationPinSchema)
    if (corps instanceof Response) return corps
    ecrireParametre(db, CLE_PIN, corps.pin === null ? PIN_DESACTIVE : hacher(corps.pin))
    return c.json({ pin: etatPin() })
  })

  routes.get('/comptes', ...reserveEmployeur, (c) =>
    c.json(
      db
        .select()
        .from(schema.comptesEmployeurs)
        .all()
        .map(({ id, identifiant, cree_le }) => ({ id, identifiant, cree_le })),
    ),
  )

  routes.post('/comptes', ...reserveEmployeur, async (c) => {
    const corps = await lireCorps(c, CreationCompteSchema)
    if (corps instanceof Response) return corps
    const existant = db
      .select()
      .from(schema.comptesEmployeurs)
      .where(eq(schema.comptesEmployeurs.identifiant, corps.identifiant))
      .get()
    if (existant !== undefined) return c.json({ erreur: 'Identifiant déjà pris' }, 409)
    const compte = {
      id: randomUUID(),
      identifiant: corps.identifiant,
      mot_de_passe_hash: hacher(corps.mot_de_passe),
      cree_le: maintenant(),
    }
    db.insert(schema.comptesEmployeurs).values(compte).run()
    return c.json({ id: compte.id, identifiant: compte.identifiant }, 201)
  })

  return routes
}
