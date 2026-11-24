#!/usr/bin/env bash
# Depuis ton poste : envoie le code sur le VPS et lance deploy.sh.
#   infra/publish.sh [domaine]
set -euo pipefail

# Serveur : variable LUKA_HOST, sinon le fichier infra/host.local (non versionné), ex. utilisateur@adresse-ip
host=${LUKA_HOST:-$(cat "$(dirname "$(readlink -f "$0")")/host.local" 2>/dev/null || true)}
[[ -n $host ]] || { echo "Indique le serveur : LUKA_HOST=utilisateur@ip ou fichier infra/host.local" >&2; exit 1; }
domain=${1:-luka.berenismassamba.com}
# Ton ~/.ssh/config désactive l'agent pour ce serveur : on le réactive ici
ssh_opts=(-o "IdentityAgent=${SSH_AUTH_SOCK:-none}" -o IdentitiesOnly=yes -i "$HOME/.ssh/id_ed25519")

cd "$(dirname "$(readlink -f "$0")")/.."
# Les déploiements passent normalement par GitHub Actions (fusion sur main). Ce script reste un secours :
# il ne publie que main, à jour avec GitHub et sans modification en cours (LUKA_FORCE=1 pour passer outre).
if [[ ${LUKA_FORCE:-} != 1 ]]; then
    git fetch --quiet origin main
    [[ $(git rev-parse --abbrev-ref HEAD) == main ]] || { echo "Tu n'es pas sur main : git checkout main && git pull" >&2; exit 1; }
    [[ -z $(git status --porcelain) ]] || { echo "Modifications non commitées : commite-les ou mets-les de côté." >&2; exit 1; }
    [[ $(git rev-parse HEAD) == $(git rev-parse origin/main) ]] || { echo "main n'est pas à jour avec GitHub : git pull (ou git push)." >&2; exit 1; }
fi
version=$(git rev-parse --short HEAD 2>/dev/null || echo dev)
[[ -z $(git status --porcelain 2>/dev/null) ]] || version="$version-$(date +%Y%m%d%H%M%S)"

echo "==> Envoi du code ($version)"
rsync -az --delete -e "ssh ${ssh_opts[*]}" \
    --exclude node_modules --exclude .next --exclude .git --exclude '.env*' --include .env.example \
    ./ "$host:luka-upload/"

echo "==> Déploiement sur le serveur"
ssh "${ssh_opts[@]}" "$host" bash -s -- "$version" "$domain" <<'REMOTE'
set -euo pipefail
version=$1 domain=$2
sudo install -d -o deploy -g deploy -m 750 /srv/luka
sudo rsync -a --delete --chown=deploy:deploy --exclude infra ~/luka-upload/ /srv/luka/src/
for f in compose.yaml luka.caddy deploy.sh web.env.template ci-receive.sh; do
    sudo install -o deploy -g deploy -m 640 ~/luka-upload/infra/$f /srv/luka/$f
done
sudo chmod 750 /srv/luka/deploy.sh /srv/luka/ci-receive.sh
sudo -iu deploy /srv/luka/deploy.sh "$version" "$domain"
REMOTE
