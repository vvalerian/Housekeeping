import fs from 'node:fs'
import path from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import type { Db } from './db/client.js'
import { routesConfiguration } from './routes/configuration.js'
import { routesEchanges } from './routes/echanges.js'
import { routesInterventions } from './routes/interventions.js'

/**
 * Assemble l'application HTTP. L'authentification (PIN tablette, identifiants
 * employeurs) arrive avec le lot 3 — cf. DECISIONS.md.
 *
 * `dossierStatique` : build de l'interface tablette (`packages/tablette/dist`),
 * servi quand il existe — l'application web et l'API partagent alors la même
 * origine, ce qui simplifie la tablette en mode kiosque.
 */
export function creerApp(db: Db, options: { dossierStatique?: string } = {}): Hono {
  const app = new Hono()

  app.get('/api/sante', (c) => c.json({ ok: true, application: 'Housekeeping' }))

  app.route('/api', routesConfiguration(db))
  app.route('/api', routesInterventions(db))
  app.route('/api', routesEchanges(db))

  if (options.dossierStatique !== undefined && fs.existsSync(options.dossierStatique)) {
    // `serveStatic` du serveur Node attend une racine relative au cwd.
    const racine = path.relative(process.cwd(), options.dossierStatique) || '.'
    app.use('*', serveStatic({ root: racine }))
    const index = serveStatic({ path: path.join(racine, 'index.html') })
    app.get('*', (c, next) => (c.req.path.startsWith('/api') ? next() : index(c, next)))
  }

  app.notFound((c) => c.json({ erreur: 'Route inconnue' }, 404))
  app.onError((erreur, c) => {
    console.error(erreur)
    return c.json({ erreur: 'Erreur interne' }, 500)
  })

  return app
}
