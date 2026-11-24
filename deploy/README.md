# Production

Luka tourne dans Docker sur le serveur partagé avec Loba et Teka, dans `/home/berenis/luka`.
Traefik (`~/traefik`) écoute sur 80 et 443, obtient les certificats HTTPS et envoie chaque domaine
vers son projet d'après les labels de son `compose.yaml`.

```
~/luka/
  compose.yaml   ← copié depuis deploy/ à chaque mise en ligne
  deploy.sh      ← idem
  .env           ← secrets et clés des services (jamais versionné, droits 600)
  .version       ← image en ligne (écrit par deploy.sh)
  backups/       ← sauvegarde quotidienne de la base, 14 jours
```

| Conteneur | Rôle |
|---|---|
| `web` | le site (réseau `edge`, joint par Traefik ; aucun port ouvert) |
| `worker` | exécute les collectes (même image, sans trafic web) |
| `db` | PostgreSQL 17 (réseau interne, volume `luka_db-data`) |
| `backup` | `pg_dump` quotidien dans `backups/` |
| `migrate` | applique les migrations avant chaque mise en ligne, puis s'arrête |

## Comment une modification arrive en ligne

Workflow `.github/workflows/ci-cd.yml` :

1. **CI**, sur chaque PR et sur `main` : types, lint, migrations à jour, build de production.
2. **CD · Images**, sur `main` si la CI passe : images `luka-web` et `luka-migrate` sur ghcr.io.
3. **CD · Mise en ligne** : connexion SSH au serveur, `deploy.sh` télécharge les images, applique
   les migrations (en cas d'échec, rien ne change), remplace le site (retour à la version précédente
   s'il ne démarre pas) et remplace le travailleur sans couper les collectes en cours.

Fusionner une PR sur `main` suffit. Pour remettre en ligne sans nouveau commit :
onglet **Actions → CI/CD → Run workflow**, branche `main`.

## Clé SSH de GitHub

Dans `~/.ssh/authorized_keys` de `berenis`, la clé de GitHub est limitée à ce script :

```
command="/home/berenis/luka/deploy.sh",restrict ssh-ed25519 AAAA… luka-ci
```

Si elle fuitait, elle ne permettrait que de remettre en ligne une image de Luka publiée sur ghcr.io :
ni shell, ni sudo, ni redirection de port.

## GitHub (Settings → Secrets and variables → Actions)

| Type | Nom | Valeur |
|---|---|---|
| Secret | `VPS_SSH_KEY` | clé privée `luka-ci` |
| Secret | `VPS_KNOWN_HOSTS` | empreinte du serveur (`ssh-keyscan -t ed25519 <ip>`) |
| Variable | `VPS_HOST` | adresse IP du serveur ; sans elle, la CD ne tourne pas |
| Variable | `LUKA_DOMAIN` | `luka.berenismassamba.com` |
| Variable | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_SENTRY_DSN` | clés publiques du navigateur |

## Exploitation

Sur le serveur, `cd ~/luka` :

```bash
dc() { docker compose --env-file .env --env-file .version "$@"; }
dc ps                                   # état des conteneurs
dc logs -f web worker                   # journaux
dc up -d --force-recreate web           # après une modification de .env…
dc up -d --force-recreate worker        # …et pour le travailleur (attend la fin de ses collectes)
./deploy.sh --run <sha complet> <utilisateur github>   # revenir à une version encore présente sur le serveur
gunzip -c backups/luka-XXXX.sql.gz | dc exec -T db psql -U luka luka   # restaurer une sauvegarde
```
