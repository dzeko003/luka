#!/usr/bin/env bash
# Construit et déploie Luka dans /srv/luka (exécuté sur le serveur par publish.sh).
#   deploy.sh <version> <domaine>
# Le code source est dans /srv/luka/src. En cas d'échec, la version précédente est remise en ligne.
set -euo pipefail
umask 077

version=${1:?version manquante}
domain=${2:?domaine manquant}
[[ $version =~ ^[0-9A-Za-z._-]+$ ]] || { echo "Version invalide : $version" >&2; exit 2; }
[[ $domain =~ ^[a-z0-9.-]+$ ]] || { echo "Domaine invalide : $domain" >&2; exit 2; }

cd "$(dirname "$(readlink -f "$0")")"
[[ -f web.env ]] || { echo "web.env manquant (infra/README.md)." >&2; exit 1; }
mkdir -p backups

# Mots de passe générés une seule fois, ils ne quittent jamais le serveur
if [[ ! -f secrets.env ]]; then
    printf 'POSTGRES_PASSWORD=%s\nBETTER_AUTH_SECRET=%s\n' \
        "$(openssl rand -hex 24)" "$(openssl rand -base64 32)" >secrets.env
    echo "==> secrets.env créé"
fi

dc() { docker compose --env-file .release --env-file secrets.env "$@"; }
write_release() { printf 'LUKA_VERSION=%s\nLUKA_DOMAIN=%s\n' "$1" "$domain" >.release; }

previous=""
[[ ! -f .release ]] || previous=$(sed -n 's/^LUKA_VERSION=//p' .release)

turnstile_key=$(sed -n 's/^NEXT_PUBLIC_TURNSTILE_SITE_KEY=//p' web.env)
# La clé d'envoi Sentry (DSN) ne permet que d'envoyer des erreurs : elle peut figurer dans le code du navigateur
sentry_dsn=$(sed -n 's/^SENTRY_DSN=//p' web.env)

echo "==> Construction des images $version"
docker build --quiet --target runner -t "luka-web:$version" \
    --build-arg "NEXT_PUBLIC_TURNSTILE_SITE_KEY=$turnstile_key" \
    --build-arg "NEXT_PUBLIC_SENTRY_DSN=$sentry_dsn" \
    --build-arg "NEXT_PUBLIC_LUKA_VERSION=$version" src >/dev/null
docker build --quiet --target migrator -t "luka-migrate:$version" src >/dev/null

write_release "$version"

echo "==> Base de données"
dc up -d --wait db

echo "==> Migrations"
if ! dc run --rm migrate; then
    [[ -z $previous ]] || write_release "$previous"
    echo "Migrations en échec : l'application n'a pas été remplacée." >&2
    exit 1
fi

echo "==> Application web"
if ! dc up -d --remove-orphans --wait --wait-timeout 120 web; then
    echo "L'application ne démarre pas." >&2
    dc logs --tail 50 web >&2 || true
    if [[ -n $previous && $previous != "$version" ]]; then
        echo "Retour à la version $previous." >&2
        write_release "$previous"
        dc up -d web
    fi
    exit 1
fi
dc up -d backup

echo "==> Travailleur des collectes"
# Le nouveau travailleur démarre à côté de l'ancien ; l'ancien finit ses collectes en cours
# (30 min au plus) puis s'arrête, en arrière-plan. Aucune collecte n'est interrompue.
old_workers=$(dc ps -q worker)
count=$(grep -c . <<<"$old_workers" || true)
dc up -d --no-deps --no-recreate --scale "worker=$((count + 1))" --wait --wait-timeout 120 worker
for id in $old_workers; do
    setsid nohup sh -c "docker stop -t 1800 $id && docker rm $id" >/dev/null 2>&1 &
done
[[ -z $old_workers ]] || echo "    $count ancien(s) travailleur(s) : arrêt après la fin de leurs collectes"

echo "==> Site dans le proxy commun"
sed "s|__DOMAIN__|$domain|g" luka.caddy >/srv/edge/sites/luka.caddy
chmod 644 /srv/edge/sites/luka.caddy
if ! docker exec edge-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
    rm -f /srv/edge/sites/luka.caddy
    echo "Le proxy commun refuse le site : l'ancienne configuration reste active." >&2
    exit 1
fi

# On garde la version actuelle et la précédente
for repo in luka-web luka-migrate; do
    docker images "$repo" --format '{{.Tag}}' | grep -vxF -e "$version" -e "${previous:-}" |
        xargs -r -I{} docker rmi "$repo:{}" >/dev/null || true
done

echo "Version $version en ligne sur https://$domain."
