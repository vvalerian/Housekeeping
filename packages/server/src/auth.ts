/**
 * Authentification (lot 3, SPEC §2 et §9) :
 * - employeurs : identifiant + mot de passe (scrypt), session de 30 jours ;
 * - observateurs : identifiant + mot de passe, lecture seule (compte donné à
 *   la société de prestation) ;
 * - tablette : code PIN à 4 chiffres, désactivable en configuration, session
 *   longue (365 jours) portée par un cookie lié à l'appareil.
 * Les sessions vivent en base (`sessions_auth`), le cookie HttpOnly `hk_session`
 * porte le jeton. Un verrou en mémoire limite la force brute.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { eq, lt } from 'drizzle-orm'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { z } from 'zod'
import type { Db } from './db/client.js'
import * as schema from './db/schema.js'

export const COOKIE_SESSION = 'hk_session'
/** Politique de mot de passe employeur, partagée par l'API et le script de réinitialisation. */
export const MotDePasseSchema = z.string().min(8).max(256)
export const CLE_PIN = 'pin_tablette_hash'
/** Valeur sentinelle du paramètre PIN : accès tablette sans code, choix explicite. */
export const PIN_DESACTIVE = 'desactive'

const DUREE_SESSION_JOURS = { employeur: 30, observateur: 30, tablette: 365 } as const

export type Acteur =
  | { type: 'employeur'; compte_id: string }
  | { type: 'observateur'; compte_id: string }
  | { type: 'tablette' }

declare module 'hono' {
  interface ContextVariableMap {
    acteur: Acteur
  }
}

// ---------------------------------------------------------------------------
// Hachage (scrypt natif — pas de dépendance)
// ---------------------------------------------------------------------------

export function hacher(secret: string): string {
  const sel = randomBytes(16).toString('hex')
  return `${sel}:${scryptSync(secret, sel, 64).toString('hex')}`
}

export function verifierSecret(secret: string, stocke: string): boolean {
  const [sel, hash] = stocke.split(':')
  if (sel === undefined || hash === undefined) return false
  const calcule = scryptSync(secret, sel, 64)
  const attendu = Buffer.from(hash, 'hex')
  return calcule.length === attendu.length && timingSafeEqual(calcule, attendu)
}

// ---------------------------------------------------------------------------
// Verrou anti-force brute (en mémoire : suffisant pour un foyer, remis à zéro
// au redémarrage)
// ---------------------------------------------------------------------------

const FENETRE_MS = 15 * 60_000
const MAX_ECHECS = 10
const tentatives = new Map<string, { echecs: number; depuis: number }>()

export function estVerrouille(cle: string): boolean {
  const entree = tentatives.get(cle)
  if (entree === undefined) return false
  if (Date.now() - entree.depuis > FENETRE_MS) {
    tentatives.delete(cle)
    return false
  }
  return entree.echecs >= MAX_ECHECS
}

export function noterEchec(cle: string): void {
  const entree = tentatives.get(cle)
  if (entree === undefined || Date.now() - entree.depuis > FENETRE_MS) {
    tentatives.set(cle, { echecs: 1, depuis: Date.now() })
  } else {
    entree.echecs += 1
  }
}

export function effacerEchecs(cle: string): void {
  tentatives.delete(cle)
}

// ---------------------------------------------------------------------------
// Paramètres persistés
// ---------------------------------------------------------------------------

export function lireParametre(db: Db, cle: string): string | null {
  return (
    db.select().from(schema.parametres).where(eq(schema.parametres.cle, cle)).get()?.valeur ?? null
  )
}

export function ecrireParametre(db: Db, cle: string, valeur: string | null): void {
  if (valeur === null) {
    db.delete(schema.parametres).where(eq(schema.parametres.cle, cle)).run()
  } else {
    db.insert(schema.parametres)
      .values({ cle, valeur })
      .onConflictDoUpdate({ target: schema.parametres.cle, set: { valeur } })
      .run()
  }
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function creerSession(
  db: Db,
  c: Context,
  type: 'employeur' | 'observateur' | 'tablette',
  compteId: string | null,
): void {
  const jeton = randomBytes(32).toString('hex')
  const jours = DUREE_SESSION_JOURS[type]
  const maintenant = new Date()
  db.insert(schema.sessionsAuth)
    .values({
      jeton,
      type,
      compte_id: compteId,
      cree_le: maintenant.toISOString(),
      expire_le: new Date(maintenant.getTime() + jours * 86_400_000).toISOString(),
    })
    .run()
  // Purge opportuniste des sessions expirées.
  db.delete(schema.sessionsAuth)
    .where(lt(schema.sessionsAuth.expire_le, maintenant.toISOString()))
    .run()
  setCookie(c, COOKIE_SESSION, jeton, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: jours * 86_400,
    // Secure quand la requête arrive en HTTPS (reverse proxy) ; laissé souple
    // pour l'accès LAN direct de la tablette en HTTP.
    secure: (c.req.header('x-forwarded-proto') ?? '') === 'https',
  })
}

export function acteurDeLaRequete(db: Db, c: Context): Acteur | null {
  const jeton = getCookie(c, COOKIE_SESSION)
  if (jeton === undefined) return null
  const session = db
    .select()
    .from(schema.sessionsAuth)
    .where(eq(schema.sessionsAuth.jeton, jeton))
    .get()
  if (session === undefined || session.expire_le <= new Date().toISOString()) return null
  if (session.type === 'tablette') return { type: 'tablette' }
  return { type: session.type, compte_id: session.compte_id! }
}

export function detruireSession(db: Db, c: Context): void {
  const jeton = getCookie(c, COOKIE_SESSION)
  if (jeton !== undefined) {
    db.delete(schema.sessionsAuth).where(eq(schema.sessionsAuth.jeton, jeton)).run()
  }
  deleteCookie(c, COOKIE_SESSION, { path: '/' })
}

// ---------------------------------------------------------------------------
// Middlewares
// ---------------------------------------------------------------------------

/** Exige une session valide (tablette ou employeur) et pose `acteur`. */
export function authentification(db: Db) {
  return createMiddleware(async (c, next) => {
    const acteur = acteurDeLaRequete(db, c)
    if (acteur === null) return c.json({ erreur: 'Authentification requise' }, 401)
    c.set('acteur', acteur)
    return next()
  })
}

/** À poser sur les routes d'administration (configuration, calendrier…). */
export const exigerEmployeur = createMiddleware(async (c, next) => {
  if (c.get('acteur')?.type !== 'employeur') {
    return c.json({ erreur: 'Réservé aux employeurs' }, 403)
  }
  return next()
})

/**
 * À poser sur les écritures « de terrain » (validation d'instances, clôture,
 * signalements, niveaux de produits, messages) : ouvertes à la tablette et
 * aux employeurs, refusées aux comptes observateurs (lecture seule).
 */
export const exigerEcriture = createMiddleware(async (c, next) => {
  if (c.get('acteur')?.type === 'observateur') {
    return c.json({ erreur: 'Compte en lecture seule' }, 403)
  }
  return next()
})
