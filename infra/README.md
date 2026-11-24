# Production sur le VPS

Luka tourne dans Docker sur le VPS (adresse dans `infra/host.local`, non versionné), dans `/srv/luka`, à côté de Loba et Teka.
Le Caddy commun (`/srv/edge`) sert le domaine et gère le HTTPS ; Luka y dépose `sites/luka.caddy`.

| Conteneur | Rôle |
|---|---|
| `web` | l'application (réseau `edge` sous le nom `luka-web`, aucun port ouvert) |
| `worker` | exécute les collectes (même image que `web`, sans trafic web, réseau `egress` pour Internet) |
| `db` | PostgreSQL 17 (réseau interne `data`, volume `luka_db-data`) |
| `backup` | `pg_dump` quotidien dans `/srv/luka/backups`, 14 jours conservés |
| `migrate` | applique les migrations à chaque déploiement, puis s'arrête |

## Première installation

1. DNS : enregistrement `A  luka → <IP_DU_VPS>`.
2. Sur le serveur, crée `/srv/luka/web.env` d'après `web.env.template` (propriétaire `deploy`, droits 600).
   `secrets.env` (mot de passe de la base, secret d'authentification) est généré automatiquement.

## Déployer

Les déploiements passent par GitHub Actions :

1. tu fusionnes une PR sur `main` ;
2. le workflow **Vérification** tourne (types, lint, migrations, build) ;
3. s'il réussit, le workflow **Déploiement** envoie le code de ce commit au serveur
   (`git archive` : seulement les fichiers commités) et lance `deploy.sh`.

`deploy.sh` construit les images, applique les migrations, remplace l'application
(retour automatique à la version précédente si elle ne démarre pas) et publie le site dans Caddy.
Les collectes en cours ne sont pas interrompues : le nouveau `worker` démarre à côté de l'ancien,
qui termine ses collectes (30 min au plus) puis s'arrête en arrière-plan.

Redéployer sans nouveau commit : onglet **Actions → Déploiement → Run workflow** (toujours `main`).
Suivi : onglet **Actions**, ou **Environments → production** sur la page du dépôt.

### Déploiement automatique : mise en place (une seule fois)

```bash
infra/setup-ci.sh
```

Le script crée une clé SSH réservée à GitHub, l'installe sur le serveur pour l'utilisateur `deploy`
et enregistre les secrets du dépôt (`DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS`).
Dans `authorized_keys`, la clé est limitée à `command="/srv/luka/ci-receive.sh",restrict` :
elle ne peut que recevoir une archive du code et lancer `deploy.sh`, sans shell ni redirection de port.
Relancer le script remplace la clé.

### Secours : déployer depuis ton poste

```bash
infra/publish.sh                      # domaine par défaut : luka.berenismassamba.com
```

Le script refuse de publier autre chose que `main` à jour avec GitHub et sans modification en cours
(`LUKA_FORCE=1 infra/publish.sh` pour passer outre, en cas d'urgence seulement).

## Exploitation

Sur le serveur, en tant que `deploy` (`sudo -iu deploy`, puis `cd /srv/luka`) :

```bash
dc() { docker compose --env-file .release --env-file secrets.env "$@"; }
dc logs -f web worker                  # journaux
dc up -d --force-recreate web          # après une modification de web.env…
dc up -d --force-recreate worker       # …et pour le travailleur (attend la fin de ses collectes)
dc ps                                  # état des conteneurs
gunzip -c backups/luka-XXXX.sql.gz | dc exec -T db psql -U luka luka   # restaurer une sauvegarde
```
