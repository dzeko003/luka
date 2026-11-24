#!/usr/bin/env bash
# Point d'entrée des déploiements GitHub Actions, sur le serveur (utilisateur deploy).
# C'est la seule commande permise à la clé SSH de GitHub (option command= dans authorized_keys) :
# elle reçoit une archive .tar.gz du code sur l'entrée standard, puis lance deploy.sh.
#   ssh deploy@serveur "<version> <domaine>" < code.tar.gz
set -euo pipefail
umask 077

read -r version domain extra <<<"${SSH_ORIGINAL_COMMAND:-}"
[[ -z ${extra:-} && ${version:-} =~ ^[0-9a-f]{7,40}$ ]] || { echo "Version invalide." >&2; exit 2; }
[[ ${domain:-} =~ ^[a-z0-9.-]+$ ]] || { echo "Domaine invalide." >&2; exit 2; }

cd /srv/luka
exec 9>.deploy.lock
flock -n 9 || { echo "Un déploiement est déjà en cours." >&2; exit 1; }

echo "==> Réception du code ($version)"
rm -rf incoming
mkdir incoming
tar -xzf - -C incoming --no-same-owner --no-same-permissions
[[ -f incoming/Dockerfile && -f incoming/infra/deploy.sh ]] || { echo "Archive incomplète." >&2; rm -rf incoming; exit 1; }

mkdir -p src
rsync -a --delete --exclude infra incoming/ src/
for f in compose.yaml luka.caddy deploy.sh web.env.template ci-receive.sh; do
    install -m 640 "incoming/infra/$f" "$f"
done
chmod 750 deploy.sh ci-receive.sh
rm -rf incoming

exec ./deploy.sh "$version" "$domain"
