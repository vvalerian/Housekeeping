# Déploiement — https://housekeeping.vv-architech.fr

Mise en ligne derrière un nginx existant : l'application tourne en conteneur
(SPEC §9), écoute uniquement sur `127.0.0.1:3000`, et nginx publie le domaine
en HTTPS avec une authentification Basic **transitoire**.

> ⚠ **À lire avant d'exposer.** L'application n'a pas encore
> d'authentification propre (lot 3). Le Basic Auth de la conf nginx est la
> seule barrière : ne jamais activer le vhost sans lui. La spec (§9)
> recommandait un accès distant via Tailscale sans ouverture de port —
> l'exposition publique est un choix assumé, consigné dans DECISIONS.md.
> Dès que le lot 3 (PIN tablette + comptes employeurs) sera déployé, retirer
> les deux lignes `auth_basic` du vhost.

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

## 3. Sauvegarde quotidienne (SPEC §8)

Dump à chaud chaque nuit, rétention 30 jours, dans `./data/backups/` :

```bash
sudo crontab -e
# 0 3 * * * cd /opt/housekeeping && docker compose exec -T app node_modules/.bin/tsx packages/server/src/db/sauvegarde.ts >> /var/log/housekeeping-backup.log 2>&1
```

## 4. Mettre à jour l'application

```bash
cd /opt/housekeeping
git pull
docker compose up -d --build
```

## La tablette dans tout ça

La tablette du domicile peut viser directement `http://IP-locale:3000` (sans
Basic Auth, hors ligne du vhost) ou l'URL publique — dans ce cas le navigateur
retient le mot de passe. Le mode kiosque proprement dit arrive au lot 4.
