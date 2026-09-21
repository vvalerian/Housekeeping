# Déploiement — https://housekeeping.vv-architech.fr

Mise en ligne derrière le nginx existant du Mac du foyer, qui porte déjà
vv-architech.fr : l'application tourne en conteneur (SPEC §9), écoute
uniquement sur `127.0.0.1:3010`, et nginx publie le domaine en HTTPS avec une
authentification Basic **transitoire**.

> ⚠ **À lire avant d'exposer.** Le Basic Auth de la conf nginx protège la
> fenêtre d'installation : ne jamais activer le vhost sans lui tant que le
> premier compte employeur n'est pas créé (étape 3 ci-dessous). La spec (§9)
> recommandait un accès distant via Tailscale sans ouverture de port —
> l'exposition publique est un choix assumé, consigné dans DECISIONS.md.

## Infrastructure réelle (relevée le 2026-09-04)

- **Serveur** : le Mac du foyer, dont l'IP publique est celle de
  `vv-architech.fr`. nginx est celui de Homebrew, lancé par launchd sous
  l'utilisateur courant : ni `sudo` ni `systemctl`. Les vhosts vivent dans
  `/opt/homebrew/etc/nginx/conf.d/*.conf` (un fichier suffixé `.disabled` est
  ignoré) ; on recharge par `nginx -t && nginx -s reload`.
- **DNS** : `housekeeping.vv-architech.fr` pointe déjà vers le serveur.
- **TLS** : certificat wildcard `*.vv-architech.fr` dans
  `/opt/homebrew/etc/nginx/ssl/vv-architech.fr/`, partagé avec les autres
  sous-domaines — pas de certbot propre à Housekeeping, le renouvellement suit
  celui du wildcard.
- **HTTP → HTTPS** : redirection globale par `conf.d/00-http.conf`.
- **Port** : 3000 est pris par le site vv-architech.fr (projet watch-me-now) ;
  Housekeeping sort sur 3010 via `HOUSEKEEPING_PORT`, dans un fichier `.env`
  non versionné à côté de `docker-compose.yml`.
- **Docker Desktop** doit tourner pour que le conteneur revienne après un
  redémarrage : activer « Start Docker Desktop when you sign in ».
- **Dépôt de production** : le clone `~/Documents/GitHub/Housekeeping`
  (convention de la machine : les services tournent depuis ce dossier).

## 1. Lancer l'application

```bash
cd ~/Documents/GitHub/Housekeeping
printf 'HOUSEKEEPING_PORT=3010\n' > .env
docker compose up -d --build
curl -s http://127.0.0.1:3010/api/sante          # → {"ok":true,...}
```

Au premier démarrage, le conteneur charge tout seul le catalogue initial
(15 pièces, 25 tâches, mode travaux). La base vit dans `./data/` sur l'hôte.

## 2. Protéger puis publier avec nginx

```bash
# Mot de passe transitoire (avant toute exposition) :
htpasswd -c /opt/homebrew/etc/nginx/housekeeping.htpasswd valerian

cp deploy/nginx/housekeeping.vv-architech.fr.conf /opt/homebrew/etc/nginx/conf.d/
nginx -t && nginx -s reload
```

Contrôles : `https://housekeeping.vv-architech.fr` demande le mot de passe puis
affiche l'accueil ; `curl -I http://…` renvoie une redirection 301 vers HTTPS ;
le port 3010 n'est pas joignable depuis l'extérieur (il n'écoute que sur
127.0.0.1).

## 3. Activer l'authentification applicative puis retirer le Basic Auth

L'application a sa propre authentification (lot 3) : comptes employeurs et
code PIN pour la tablette.

1. Ouvrir `https://housekeeping.vv-architech.fr/admin` (passer le Basic Auth)
   et **créer le premier compte employeur** — l'écran d'initialisation ne
   s'affiche que tant qu'aucun compte n'existe.
2. Dans l'espace employeur, page **Sécurité** : définir le code PIN de la
   tablette (ou le désactiver explicitement pour un usage purement local).
3. Retirer alors les deux lignes `auth_basic` du vhost dans `conf.d/`, puis
   `nginx -t && nginx -s reload`. La connexion applicative prend le relais :
   identifiant/mot de passe sur `/admin`, PIN sur la tablette (session d'un an
   sur l'appareil).

## 4. Sauvegarde quotidienne (SPEC §8)

Dump à chaud chaque nuit, rétention 30 jours, dans `./data/backups/` :

```bash
crontab -e
# 0 3 * * * /usr/local/bin/docker exec housekeeping-app-1 node_modules/.bin/tsx packages/server/src/db/sauvegarde.ts >> $HOME/Library/Logs/housekeeping-backup.log 2>&1
```

`docker exec` sur le conteneur plutôt que `docker compose exec` : cron n'a pas
accès à `~/Documents` (protection macOS) et n'a pas besoin du fichier compose.
Test manuel : la même commande sans la redirection.

## 5. Mettre à jour l'application

```bash
cd ~/Documents/GitHub/Housekeeping
git pull
docker compose up -d --build
```

**Mise à jour du 2026-09-21 (bilinguisme)** : après le rebuild, compléter une
seule fois les traductions pt-BR du catalogue existant (idempotent, ne touche
que les champs vides) :

```bash
docker exec housekeeping-app-1 node_modules/.bin/tsx packages/server/src/db/traductions.ts
```

## Le téléphone de l'intervenante

Sur son téléphone (réglé en portugais — l'interface et le catalogue suivent la
langue de l'appareil) : ouvrir `https://housekeeping.vv-architech.fr` dans
Chrome, saisir le code PIN, puis menu ⋮ → **« Adicionar à tela inicial »** :
l'application s'installe comme une app (icône 🧹, plein écran). La session
dure un an sur l'appareil.

## 6. Mot de passe employeur oublié

Aucune route web ne le permet (volontairement) ; on le réinitialise sur le
serveur, dans le conteneur. L'identifiant est sensible à la casse. Le secret
passe par l'environnement pour ne pas apparaître dans `ps` ni dans
l'historique du shell :

```bash
read -s 'MDP?Nouveau mot de passe : '
docker exec -e HOUSEKEEPING_MDP="$MDP" housekeeping-app-1 \
  node_modules/.bin/tsx packages/server/src/db/mot-de-passe.ts <identifiant>
```

Les sessions ouvertes du compte sont fermées. Après dix échecs de connexion
en quinze minutes, l'identifiant est bloqué le temps restant de la fenêtre.

## La tablette dans tout ça

La tablette du domicile peut viser directement `http://IP-locale:3010` (hors
vhost nginx) ou l'URL publique. Dans les deux cas elle est verrouillée par le
code PIN défini dans l'espace employeur ; sa session dure un an sur
l'appareil. Le mode kiosque proprement dit arrive au lot 4.
