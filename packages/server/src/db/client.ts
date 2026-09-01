import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema.js'

export const CHEMIN_BASE_DEFAUT = process.env.HOUSEKEEPING_DB ?? './data/housekeeping.db'

/** Ouvre (et crée/migre si besoin) la base SQLite. `:memory:` pour les tests. */
export function ouvrirBase(chemin: string = CHEMIN_BASE_DEFAUT) {
  if (chemin !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(chemin)), { recursive: true })
  }
  const sqlite = new Database(chemin)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) })
  return db
}

export type Db = ReturnType<typeof ouvrirBase>
