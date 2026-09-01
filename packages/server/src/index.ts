import { serve } from '@hono/node-server'
import { creerApp } from './app.js'
import { CHEMIN_BASE_DEFAUT, ouvrirBase } from './db/client.js'
import { baseDejaPeuplee } from './db/seed.js'

const db = ouvrirBase()
if (!baseDejaPeuplee(db)) {
  console.warn(
    `La base ${CHEMIN_BASE_DEFAUT} est vide : lancer \`npm run db:seed\` pour charger le catalogue.`,
  )
}

const port = Number(process.env.PORT ?? 3000)
serve({ fetch: creerApp(db).fetch, port }, (info) => {
  console.log(`API Housekeeping sur http://localhost:${info.port} (base : ${CHEMIN_BASE_DEFAUT})`)
})
