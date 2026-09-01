import { Hono } from 'hono'
import type { Db } from './db/client.js'
import { routesConfiguration } from './routes/configuration.js'
import { routesEchanges } from './routes/echanges.js'
import { routesInterventions } from './routes/interventions.js'

/**
 * Assemble l'application HTTP. L'authentification (PIN tablette, identifiants
 * employeurs) arrive avec les lots 2/3 — cf. CLAUDE.md.
 */
export function creerApp(db: Db): Hono {
  const app = new Hono()

  app.get('/api/sante', (c) => c.json({ ok: true, application: 'Housekeeping' }))

  app.route('/api', routesConfiguration(db))
  app.route('/api', routesInterventions(db))
  app.route('/api', routesEchanges(db))

  app.notFound((c) => c.json({ erreur: 'Route inconnue' }, 404))
  app.onError((erreur, c) => {
    console.error(erreur)
    return c.json({ erreur: 'Erreur interne' }, 500)
  })

  return app
}
