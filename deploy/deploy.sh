#!/usr/bin/env bash
# Met en ligne une version de Luka, sur le serveur dans ~/luka. Lancé par GitHub Actions (job « CD ») :
#   ssh berenis@serveur "<sha> <utilisateur github>"  < (jeton ghcr sur la 1re ligne, puis archive de deploy/)
# La clé SSH de GitHub ne peut lancer que ce script (command= dans ~/.ssh/authorized_keys).
#
# Étapes : récupère compose.yaml et deploy.sh à jour, télécharge les images, applique les migrations
# (en cas d'échec, rien ne change), remplace le site (retour à la version précédente s'il ne démarre pas),
# puis remplace le travailleur sans interrompre les collectes en cours.
set -euo pipefail
umask 077
cd "$(dirname "$(readlink -f "$0")")"

# 1. Réception : appelé par SSH, on met à jour compose.yaml et ce script, puis on relance la nouvelle version
if [[ ${1:-} != --run ]]; then
    read -r version actor extra <<<"${SSH_ORIGINAL_COMMAND:-${*:-}}"
    [[ -z ${extra:-} && ${version:-} =~ ^[0-9a-f]{40}$ ]] || { echo "Version invalide." >&2; exit 2; }
    [[ ${actor:-} =~ ^[A-Za-z0-9-]{1,39}$ ]] || { echo "Utilisateur invalide." >&2; exit 2; }
    IFS= read -r token || token=""
    incoming=$(mktemp -d)
    tar -xzf - -C "$incoming" --no-same-owner --no-same-permissions compose.yaml deploy.sh
    install -m 640 "$incoming/compose.yaml" compose.yaml
    install -m 750 "$incoming/deploy.sh" deploy.sh
    rm -rf "$incoming"
    REGISTRY_TOKEN=$token exec ./deploy.sh --run "$version" "$actor"
fi

# 2. Déploiement
version=$2 actor=$3
exec 9>.deploy.lock
flock -n 9 || { echo "Un déploiement est déjà en cours." >&2; exit 1; }
[[ -f .env ]] || { echo "~/luka/.env manquant (deploy/README.md)." >&2; exit 1; }

dc() { docker compose --env-file .env --env-file .version "$@"; }
set_version() { printf 'LUKA_VERSION=%s\n' "$1" >.version; }
previous=$(sed -n 's/^LUKA_VERSION=//p' .version 2>/dev/null || true)
rollback() { if [[ -n $previous ]]; then set_version "$previous"; fi; }

# Le jeton (lecture seule, valable le temps du job) ne sert qu'ici et n'est jamais écrit durablement
DOCKER_CONFIG=$(mktemp -d)
export DOCKER_CONFIG
trap 'rm -rf "$DOCKER_CONFIG"' EXIT
if [[ -n ${REGISTRY_TOKEN:-} ]]; then
    docker login ghcr.io -u "$actor" --password-stdin <<<"$REGISTRY_TOKEN" >/dev/null
fi
unset REGISTRY_TOKEN

echo "==> Images ${version:0:7}"
set_version "$version"
pulled=false
for attempt in 1 2 3; do
    if dc pull --quiet web migrate; then pulled=true; break; fi
    sleep $((attempt * 15))
done
# Sans accès au registre (retour manuel à une version), les images déjà présentes sur le serveur suffisent
if ! $pulled && ! { docker image inspect "ghcr.io/dzeko003/luka-web:$version" "ghcr.io/dzeko003/luka-migrate:$version" >/dev/null 2>&1; }; then
    rollback
    echo "Images introuvables : rien n'a changé." >&2
    exit 1
fi

echo "==> Base de données et migrations"
dc up -d --wait db
if ! dc run --rm migrate; then
    rollback
    echo "Migrations en échec : le site n'a pas été remplacé." >&2
    exit 1
fi

echo "==> Site"
if ! dc up -d --remove-orphans --wait --wait-timeout 120 web; then
    echo "Le site ne démarre pas." >&2
    dc logs --tail 50 web >&2 || true
    if [[ -n $previous && $previous != "$version" ]]; then
        echo "Retour à la version ${previous:0:7}." >&2
        rollback
        dc up -d web
    fi
    exit 1
fi
dc up -d backup

echo "==> Travailleur des collectes"
# Le nouveau démarre à côté de l'ancien ; l'ancien finit ses collectes (30 min au plus) puis s'arrête.
old_workers=$(dc ps -q worker)
count=$(grep -c . <<<"$old_workers" || true)
dc up -d --no-deps --no-recreate --scale "worker=$((count + 1))" --wait --wait-timeout 120 worker
for id in $old_workers; do
    setsid nohup sh -c "docker stop -t 1800 $id && docker rm $id" >/dev/null 2>&1 &
done

docker image prune -af --filter "until=168h" >/dev/null || true
echo "Version ${version:0:7} en ligne."
