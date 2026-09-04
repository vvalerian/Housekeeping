/**
 * Sauvegarde quotidienne de la base (SPEC §8 : dump quotidien, rétention
 * 30 jours). À lancer par cron — cf. deploy/README.md :
 *
 *   npm run db:backup -w @housekeeping/server
 *
 * Écrit `housekeeping-AAAA-MM-JJ.db` dans le dossier `backups` à côté de la
 * base (surchargeable via HOUSEKEEPING_BACKUPS), via l'API de sauvegarde à
 * chaud de SQLite, puis purge les fichiers plus vieux que la rétention.
 */
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const RETENTION_JOURS = 30

const source = process.env.HOUSEKEEPING_DB ?? './data/housekeeping.db'
if (!fs.existsSync(source)) {
  console.error(`Base introuvable : ${source}`)
  process.exit(1)
}

const dossier =
  process.env.HOUSEKEEPING_BACKUPS ?? path.join(path.dirname(path.resolve(source)), 'backups')
fs.mkdirSync(dossier, { recursive: true })

const jour = new Date().toISOString().slice(0, 10)
const destination = path.join(dossier, `housekeeping-${jour}.db`)

const db = new Database(source, { readonly: true, fileMustExist: true })
await db.backup(destination)
db.close()
console.log(`Sauvegarde écrite : ${destination}`)

const limite = new Date(Date.now() - RETENTION_JOURS * 86_400_000).toISOString().slice(0, 10)
for (const fichier of fs.readdirSync(dossier)) {
  const correspondance = /^housekeeping-(\d{4}-\d{2}-\d{2})\.db$/.exec(fichier)
  if (correspondance !== null && correspondance[1]! < limite) {
    fs.rmSync(path.join(dossier, fichier))
    console.log(`Sauvegarde purgée (rétention ${RETENTION_JOURS} j) : ${fichier}`)
  }
}
