# Image de production Housekeeping (SPEC §9 : déploiement en conteneur).
# Construire depuis la RACINE du dépôt :
#   docker compose up -d --build     (cf. docker-compose.yml)

# --- Étape 1 : build de l'interface tablette -------------------------------
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/tablette/package.json packages/tablette/
COPY packages/employeur/package.json packages/employeur/
RUN npm ci
COPY . .
RUN npm run build

# --- Étape 2 : dépendances de production seules ----------------------------
FROM node:22-slim AS dependances
WORKDIR /app
# Outils de compilation au cas où better-sqlite3 n'aurait pas de binaire
# précompilé pour l'architecture cible (Raspberry Pi, etc.).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/tablette/package.json packages/tablette/
COPY packages/employeur/package.json packages/employeur/
RUN npm ci --omit=dev

# --- Étape 3 : image finale -------------------------------------------------
FROM node:22-slim
ENV NODE_ENV=production \
    HOUSEKEEPING_DB=/data/housekeeping.db \
    PORT=3000
WORKDIR /app
COPY --from=dependances /app/node_modules ./node_modules
COPY package.json ./
COPY packages/core ./packages/core
COPY packages/server ./packages/server
COPY --from=build /app/packages/tablette/dist ./packages/tablette/dist
COPY --from=build /app/packages/employeur/dist ./packages/employeur/dist
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /data && chown node:node /data /app
USER node
VOLUME /data
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
