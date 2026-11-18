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
for f in compose.yaml luka.caddy deploy.sh web.env.template; do
    sudo install -o deploy -g deploy -m 640 ~/luka-upload/infra/$f /srv/luka/$f
done
sudo chmod 750 /srv/luka/deploy.sh
sudo -iu deploy /srv/luka/deploy.sh "$version" "$domain"
REMOTE
