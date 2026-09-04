import fs from 'node:fs'
import path from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { authentification } from './auth.js'
import type { Db } from './db/client.js'
import { routesAuth } from './routes/auth.js'
import { routesConfiguration } from './routes/configuration.js'
import { routesEchanges } from './routes/echanges.js'
import { routesInterventions } from './routes/interventions.js'

export interface OptionsApp {
  /** Build de l'interface tablette (`packages/tablette/dist`), servi à la racine. */
  dossierStatique?: string
  /** Build de l'espace employeur (`packages/employeur/dist`), servi sous /admin. */
  dossierEmployeur?: string
}

/**
 * Assemble l'application HTTP. Toute l'API exige une session (lot 3) sauf la
 * santé et les endpoints d'authentification ; les routes d'administration
 * portent en plus la garde `exigerEmployeur`.
 */
export function creerApp(db: Db, options: OptionsApp = {}): Hono {
  const app = new Hono()

  app.get('/api/sante', (c) => c.json({ ok: true, application: 'Housekeeping' }))
  app.route('/api/auth', routesAuth(db))

  // Tout le reste de l'API exige une session valide.
  app.use('/api/*', authentification(db))
  app.route('/api', routesConfiguration(db))
  app.route('/api', routesInterventions(db))
  app.route('/api', routesEchanges(db))

  // Espace employeur sous /admin (SPA, assets préfixés par sa base Vite).
  if (options.dossierEmployeur !== undefined && fs.existsSync(options.dossierEmployeur)) {
    const racine = path.relative(process.cwd(), options.dossierEmployeur) || '.'
    app.use(
      '/admin/*',
      serveStatic({ root: racine, rewriteRequestPath: (chemin) => chemin.replace(/^\/admin/, '') }),
    )
    const index = serveStatic({ path: path.join(racine, 'index.html') })
    app.get('/admin', (c, next) => index(c, next))
    app.get('/admin/*', (c, next) => index(c, next))
  }

  // Interface tablette à la racine.
  if (options.dossierStatique !== undefined && fs.existsSync(options.dossierStatique)) {
    // `serveStatic` du serveur Node attend une racine relative au cwd.
    const racine = path.relative(process.cwd(), options.dossierStatique) || '.'
    app.use('*', serveStatic({ root: racine }))
    const index = serveStatic({ path: path.join(racine, 'index.html') })
    app.get('*', (c, next) =>
      c.req.path.startsWith('/api') || c.req.path.startsWith('/admin')
        ? next()
        : index(c, next),
    )
  }

  app.notFound((c) => c.json({ erreur: 'Route inconnue' }, 404))
  app.onError((erreur, c) => {
    console.error(erreur)
    return c.json({ erreur: 'Erreur interne' }, 500)
  })

  return app
}
