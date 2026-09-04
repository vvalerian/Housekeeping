# Déploiement — https://housekeeping.vv-architech.fr

Mise en ligne derrière un nginx existant : l'application tourne en conteneur
(SPEC §9), écoute uniquement sur `127.0.0.1:3000`, et nginx publie le domaine
en HTTPS avec une authentification Basic **transitoire**.

> ⚠ **À lire avant d'exposer.** Le Basic Auth de la conf nginx protège la
> fenêtre d'installation : ne jamais activer le vhost sans lui tant que le
> premier compte employeur n'est pas créé (étape 3 ci-dessous). La spec (§9)
> recommandait un accès distant via Tailscale sans ouverture de port —
> l'exposition publique est un choix assumé, consigné dans DECISIONS.md.

## Prérequis

- Un enregistrement DNS `A` (et `AAAA` le cas échéant) :
  `housekeeping.vv-architech.fr` → IP publique du serveur.
- Sur le serveur : Docker + le plugin compose, nginx, certbot
  (`sudo apt install certbot python3-certbot-nginx apache2-utils`).

## 1. Lancer l'application

```bash
sudo mkdir -p /opt && cd /opt
git clone https://github.com/vvalerian/Housekeeping.git housekeeping
cd housekeeping
mkdir -p data && sudo chown -R 1000:1000 data   # l'image tourne sous l'utilisateur node (uid 1000)
docker compose up -d --build
curl -s http://127.0.0.1:3000/api/sante          # → {"ok":true,...}
```

Au premier démarrage, le conteneur charge tout seul le catalogue initial
(15 pièces, 25 tâches, mode travaux). La base vit dans `./data/` sur l'hôte.

## 2. Protéger puis publier avec nginx

```bash
# Mot de passe transitoire (avant toute exposition) :
sudo htpasswd -c /etc/nginx/htpasswd-housekeeping valerian

sudo cp deploy/nginx/housekeeping.vv-architech.fr.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/housekeeping.vv-architech.fr.conf /etc/nginx/sites-enabled/
```

**Voie A (recommandée)** — laisser certbot écrire le TLS : commenter
provisoirement le bloc `server { listen 443 … }` du vhost, puis :

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d housekeeping.vv-architech.fr
```

`certbot --nginx` ajoute le TLS et la redirection, et programme le
renouvellement automatique. Vérifier ensuite que `auth_basic` figure bien dans
le bloc 443 généré.

**Voie B** — garder le vhost fourni tel quel (chemins certbot standard) et
obtenir d'abord le certificat en mode webroot :

```bash
sudo mkdir -p /var/www/certbot
sudo certbot certonly --webroot -w /var/www/certbot -d housekeeping.vv-architech.fr
sudo nginx -t && sudo systemctl reload nginx
```

Contrôles : `https://housekeeping.vv-architech.fr` demande le mot de passe puis
affiche l'accueil ; `curl -I http://…` renvoie une redirection 301 vers HTTPS ;
le port 3000 n'est pas joignable depuis l'extérieur (il n'écoute que sur
127.0.0.1).

## 3. Activer l'authentification applicative puis retirer le Basic Auth

L'application a sa propre authentification (lot 3) : comptes employeurs et
code PIN pour la tablette.

1. Ouvrir `https://housekeeping.vv-architech.fr/admin` (passer le Basic Auth)
   et **créer le premier compte employeur** — l'écran d'initialisation ne
   s'affiche que tant qu'aucun compte n'existe.
2. Dans l'espace employeur, page **Sécurité** : définir le code PIN de la
   tablette (ou le désactiver explicitement pour un usage purement local).
3. Retirer alors les deux lignes `auth_basic` du vhost, puis
   `sudo nginx -t && sudo systemctl reload nginx`. La connexion applicative
   prend le relais : identifiant/mot de passe sur `/admin`, PIN sur la
   tablette (session d'un an sur l'appareil).

## 4. Sauvegarde quotidienne (SPEC §8)

Dump à chaud chaque nuit, rétention 30 jours, dans `./data/backups/` :

```bash
sudo crontab -e
# 0 3 * * * cd /opt/housekeeping && docker compose exec -T app node_modules/.bin/tsx packages/server/src/db/sauvegarde.ts >> /var/log/housekeeping-backup.log 2>&1
```

## 5. Mettre à jour l'application

```bash
cd /opt/housekeeping
git pull
docker compose up -d --build
```

## La tablette dans tout ça

La tablette du domicile peut viser directement `http://IP-locale:3000` (hors
vhost nginx) ou l'URL publique. Dans les deux cas elle est verrouillée par le
code PIN défini dans l'espace employeur ; sa session dure un an sur
l'appareil. Le mode kiosque proprement dit arrive au lot 4.
