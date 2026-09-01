import type { Context } from 'hono'
import type { z } from 'zod'

/**
 * Lit et valide le corps JSON d'une requête. Retourne la donnée typée, ou une
 * `Response` 400 prête à renvoyer :
 *
 *   const corps = await lireCorps(c, MonSchema)
 *   if (corps instanceof Response) return corps
 */
export async function lireCorps<S extends z.ZodType>(
  c: Context,
  schema: S,
): Promise<z.infer<S> | Response> {
  const brut = await c.req.json().catch(() => null)
  const resultat = schema.safeParse(brut)
  if (!resultat.success) {
    return c.json({ erreur: 'Corps de requête invalide', details: resultat.error.issues }, 400)
  }
  return resultat.data as z.infer<S>
}

export const maintenant = (): string => new Date().toISOString()

/** Date du jour dans le fuseau du serveur (AAAA-MM-JJ). */
export const aujourdHui = (): string => new Date().toLocaleDateString('en-CA')
