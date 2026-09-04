/**
 * Réinitialise le mot de passe d'un compte employeur. Aucune route API ne le
 * permet : un mot de passe oublié se règle sur le serveur, jamais depuis le
 * web. Sur le serveur, dans le conteneur (cf. deploy/README.md §6) :
 *
 *   read -s 'MDP?Nouveau mot de passe : '
 *   docker exec -e HOUSEKEEPING_MDP="$MDP" housekeeping-app-1 \
 *     node_modules/.bin/tsx packages/server/src/db/mot-de-passe.ts <identifiant>
 *
 * Le secret passe par l'environnement, jamais par un argument (visible dans
 * `ps` et dans l'historique du shell). Les sessions ouvertes du compte sont
 * fermées. Le verrou anti-force brute du serveur, en mémoire, expire seul
 * (15 min).
 */
import { pathToFileURL } from 'node:url'
import { eq } from 'drizzle-orm'
import { hacher, MotDePasseSchema } from '../auth.js'
import { CHEMIN_BASE_DEFAUT, ouvrirBase, type Db } from './client.js'
import * as schema from './schema.js'

/** Remplace le mot de passe et ferme les sessions du compte. `false` si le compte n'existe pas. */
export function reinitialiserMotDePasse(db: Db, identifiant: string, secret: string): boolean {
  const compte = db
    .select({ id: schema.comptesEmployeurs.id })
    .from(schema.comptesEmployeurs)
    .where(eq(schema.comptesEmployeurs.identifiant, identifiant))
    .get()
  if (compte === undefined) return false
  db.transaction((tx) => {
    tx.update(schema.comptesEmployeurs)
      .set({ mot_de_passe_hash: hacher(secret) })
      .where(eq(schema.comptesEmployeurs.id, compte.id))
      .run()
    tx.delete(schema.sessionsAuth).where(eq(schema.sessionsAuth.compte_id, compte.id)).run()
  })
  return true
}

function principal(): void {
  const identifiant = process.argv[2]
  const secret = process.env.HOUSEKEEPING_MDP
  if (identifiant === undefined || secret === undefined) {
    console.error('Usage : HOUSEKEEPING_MDP=<nouveau mot de passe> mot-de-passe.ts <identifiant>')
    process.exitCode = 2
    return
  }
  if (!MotDePasseSchema.safeParse(secret).success) {
    console.error('Mot de passe refusé : 8 à 256 caractères.')
    process.exitCode = 2
    return
  }
  if (!reinitialiserMotDePasse(ouvrirBase(), identifiant, secret)) {
    console.error(`Compte introuvable : ${identifiant} (base : ${CHEMIN_BASE_DEFAUT}).`)
    process.exitCode = 1
    return
  }
  console.log(`Mot de passe de « ${identifiant} » réinitialisé, sessions fermées.`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
