# Production sur le VPS

Luka tourne dans Docker sur le VPS (adresse dans `infra/host.local`, non versionné), dans `/srv/luka`, à côté de Loba et Teka.
Le Caddy commun (`/srv/edge`) sert le domaine et gère le HTTPS ; Luka y dépose `sites/luka.caddy`.

| Conteneur | Rôle |
|---|---|
| `web` | l'application (réseau `edge` sous le nom `luka-web`, aucun port ouvert) |
| `db` | PostgreSQL 17 (réseau interne `data`, volume `luka_db-data`) |
| `backup` | `pg_dump` quotidien dans `/srv/luka/backups`, 14 jours conservés |
| `migrate` | applique les migrations à chaque déploiement, puis s'arrête |

## Première installation

1. DNS : enregistrement `A  luka → <IP_DU_VPS>`.
2. Sur le serveur, crée `/srv/luka/web.env` d'après `web.env.template` (propriétaire `deploy`, droits 600).
   `secrets.env` (mot de passe de la base, secret d'authentification) est généré automatiquement.

## Déployer

Depuis ton poste, à la racine du projet :

```bash
infra/publish.sh                      # domaine par défaut : luka.berenismassamba.com
```

Le script envoie le code, construit les images sur le serveur, applique les migrations,
remplace l'application (retour automatique à la version précédente si elle ne démarre pas)
et publie le site dans Caddy.

## Exploitation

Sur le serveur, en tant que `deploy` (`sudo -iu deploy`, puis `cd /srv/luka`) :

```bash
dc() { docker compose --env-file .release --env-file secrets.env "$@"; }
dc logs -f web                         # journaux
dc ps                                  # état des conteneurs
gunzip -c backups/luka-XXXX.sql.gz | dc exec -T db psql -U luka luka   # restaurer une sauvegarde
```
