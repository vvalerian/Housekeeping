# Prompt de déploiement — à donner à une session Claude Code locale

À lancer depuis le clone local (`~/Documents/GitHub/Housekeeping`), sur une
machine ayant accès au serveur nginx (localement ou par SSH). Copier tout le
bloc ci-dessous comme premier message de la session.

---

Déploie l'application Housekeeping en ligne sur https://housekeeping.vv-architech.fr en suivant `deploy/README.md` de ce dépôt. Tout le nécessaire est déjà commité sur la branche `claude/housekeeping-specs-p5sgwt` (seule branche du dépôt — pas de main) : `docker-compose.yml`, `deploy/Dockerfile`, `deploy/nginx/housekeeping.vv-architech.fr.conf`, `deploy/README.md`, script de sauvegarde `db:backup`.

**Règles absolues, avant toute chose :**
- L'application n'a PAS encore d'authentification propre (elle arrive au lot 3). Ne JAMAIS activer le vhost sans ses lignes `auth_basic`, et ne jamais publier le port 3000 ailleurs que sur 127.0.0.1.
- `nginx -t` avant chaque reload ; ne toucher à aucun autre vhost existant ; me montrer le diff avant de modifier une conf déjà en place.
- Ne pas inventer de mot de passe : me demander de saisir le htpasswd en interactif.

**Étape 0 — situer l'infrastructure :**
- Vérifie si nginx tourne sur cette machine (`systemctl status nginx`). Si oui, tout se fait ici. Sinon, demande-moi l'hôte SSH du serveur qui porte nginx et vv-architech.fr, et exécute la suite à travers ssh.
- Vérifie que `housekeeping.vv-architech.fr` résout vers l'IP publique de ce serveur (`dig +short housekeeping.vv-architech.fr`). Si l'enregistrement DNS n'existe pas, demande-moi de le créer (A → IP du serveur) et attends qu'il propage avant l'étape certbot.
- Vérifie la présence de docker + plugin compose, certbot, apache2-utils sur le serveur ; propose l'installation de ce qui manque.

**Étapes (le détail est dans `deploy/README.md`) :**
1. Sur le serveur : `git clone -b claude/housekeeping-specs-p5sgwt https://github.com/vvalerian/Housekeeping.git /opt/housekeeping`, puis `mkdir -p /opt/housekeeping/data && chown -R 1000:1000 /opt/housekeeping/data` (l'image tourne sous l'uid 1000).
2. `docker compose up -d --build` puis contrôle : `curl -s http://127.0.0.1:3000/api/sante` → `{"ok":true,…}` (le premier démarrage charge le catalogue tout seul).
3. `htpasswd -c /etc/nginx/htpasswd-housekeeping valerian` (je saisis le mot de passe).
4. Installer le vhost `deploy/nginx/housekeeping.vv-architech.fr.conf` (sites-available + symlink sites-enabled) selon la **voie A** du README : bloc 443 commenté d'abord, `nginx -t && reload`, puis `certbot --nginx -d housekeeping.vv-architech.fr`. Vérifier ensuite que le bloc 443 final contient bien `auth_basic`.
5. Brancher la sauvegarde quotidienne (03:00) : cron du README §3.
6. Vérifications finales : `https://housekeeping.vv-architech.fr` demande le mot de passe puis affiche l'accueil ; `curl -I http://…` → 301 ; le port 3000 est injoignable depuis l'extérieur ; `docker compose ps` sain ; le renouvellement certbot est programmé (`certbot renew --dry-run`).

Rollback si besoin : retirer le symlink de sites-enabled, `nginx -t`, reload — l'application continue de tourner en local sur 127.0.0.1:3000.

En terminant, donne-moi un récapitulatif : URL fonctionnelle, emplacement de la base et des sauvegardes, et la commande de mise à jour (`git pull && docker compose up -d --build`).
