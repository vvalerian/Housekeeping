#!/bin/sh
set -e

# Premier démarrage : charge le catalogue initial (le seed refuse d'écraser
# une base déjà peuplée, ce test évite simplement un message d'erreur).
if [ ! -f "$HOUSEKEEPING_DB" ]; then
  echo "Base absente — chargement du catalogue initial…"
  node_modules/.bin/tsx packages/server/src/db/seed.ts
fi

exec node_modules/.bin/tsx packages/server/src/index.ts
