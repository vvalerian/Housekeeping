/**
 * Seed exécutable (SPEC §4) : charge le catalogue initial (pièces et tâches)
 * dans la base. Après le seed, la base fait foi et tout se modifie via l'API
 * — relancer avec `--reset` pour repartir du catalogue (efface TOUT, historique
 * compris).
 *
 *   npm run db:seed            # refuse d'écraser une base déjà peuplée
 *   npm run db:seed -- --reset
 */
import { pathToFileURL } from 'node:url'
import { PIECES_INITIALES, TACHES_INITIALES, TRAVAUX_EN_COURS } from '@housekeeping/core'
import { CHEMIN_BASE_DEFAUT, ouvrirBase, type Db } from './client.js'
import * as schema from './schema.js'

/** Insère le catalogue dans une base vierge. Utilisé par le CLI et les tests. */
export function chargerCatalogue(db: Db): void {
  const piecesAvecTravaux = PIECES_INITIALES.map((piece) =>
    TRAVAUX_EN_COURS.piece_ids.includes(piece.id)
      ? {
          ...piece,
          periodes_inactivite: [
            ...piece.periodes_inactivite,
            { debut: TRAVAUX_EN_COURS.debut, fin: null, motif: TRAVAUX_EN_COURS.motif },
          ],
        }
      : piece,
  )
  db.insert(schema.pieces).values(piecesAvecTravaux).run()
  db.insert(schema.taches).values(TACHES_INITIALES).run()
}

export function baseDejaPeuplee(db: Db): boolean {
  return db.select().from(schema.pieces).all().length > 0
}

function viderBase(db: Db): void {
  // Ordre inverse des dépendances de clés étrangères.
  db.delete(schema.taskInstances).run()
  db.delete(schema.demandesPonctuelles).run()
  db.delete(schema.signalements).run()
  db.delete(schema.messages).run()
  db.delete(schema.produits).run()
  db.delete(schema.interventions).run()
  db.delete(schema.taches).run()
  db.delete(schema.pieces).run()
}

function principal(): void {
  const reset = process.argv.includes('--reset')
  const db = ouvrirBase()
  if (baseDejaPeuplee(db)) {
    if (!reset) {
      console.error(
        `La base ${CHEMIN_BASE_DEFAUT} est déjà peuplée. Relancer avec --reset pour TOUT effacer et recharger le catalogue.`,
      )
      process.exitCode = 1
      return
    }
    viderBase(db)
    console.log('Base vidée (--reset).')
  }
  chargerCatalogue(db)
  console.log(
    `Catalogue chargé : ${PIECES_INITIALES.length} pièces, ${TACHES_INITIALES.length} tâches (base : ${CHEMIN_BASE_DEFAUT}).`,
  )
  if (TRAVAUX_EN_COURS.piece_ids.length > 0) {
    console.log(
      `Mode travaux appliqué depuis le ${TRAVAUX_EN_COURS.debut} : ${TRAVAUX_EN_COURS.piece_ids.join(', ')}.`,
    )
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
