#!/usr/bin/env bash
# Une seule fois, depuis ton poste : prépare les déploiements par GitHub Actions.
#   infra/setup-ci.sh
# 1. crée une clé SSH réservée à GitHub (elle ne quitte ton poste que vers GitHub, puis est effacée) ;
# 2. l'installe sur le serveur pour l'utilisateur deploy, limitée à /srv/luka/ci-receive.sh ;
# 3. enregistre les secrets du dépôt : DEPLOY_SSH_KEY, DEPLOY_HOST, DEPLOY_KNOWN_HOSTS.
# Relancer le script remplace la clé (l'ancienne est retirée du serveur).
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")/.."
host=${LUKA_HOST:-$(cat infra/host.local 2>/dev/null || true)}
[[ -n $host ]] || { echo "Indique le serveur : LUKA_HOST=utilisateur@ip ou fichier infra/host.local" >&2; exit 1; }
server=${host#*@}
ssh_opts=(-o "IdentityAgent=${SSH_AUTH_SOCK:-none}" -o IdentitiesOnly=yes -i "$HOME/.ssh/id_ed25519")
command -v gh >/dev/null || { echo "GitHub CLI (gh) requis." >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
ssh-keygen -q -t ed25519 -N "" -C "github-actions-luka" -f "$tmp/key"

echo "==> Installation de la clé sur le serveur"
ssh "${ssh_opts[@]}" "$host" sudo bash -s -- "$(cat "$tmp/key.pub")" "$(base64 -w0 infra/ci-receive.sh)" <<'REMOTE'
set -euo pipefail
pub=$1 script=$2
entry=$(getent passwd deploy) || { echo "Utilisateur deploy introuvable." >&2; exit 1; }
home=$(cut -d: -f6 <<<"$entry")
shell=$(cut -d: -f7 <<<"$entry")
# La commande imposée s'exécute avec le shell de l'utilisateur : il en faut un vrai
case $shell in
    */nologin | */false) usermod -s /bin/bash deploy && echo "    shell de deploy : /bin/bash" ;;
esac
install -d -o deploy -g deploy -m 750 /srv/luka
base64 -d <<<"$script" | install -o deploy -g deploy -m 750 /dev/stdin /srv/luka/ci-receive.sh
install -d -o deploy -g deploy -m 700 "$home/.ssh"
keys=$home/.ssh/authorized_keys
touch "$keys"
sed -i '/ github-actions-luka$/d' "$keys"
printf 'command="/srv/luka/ci-receive.sh",restrict %s\n' "$pub" >>"$keys"
chown deploy:deploy "$keys"
chmod 600 "$keys"
REMOTE

echo "==> Test de la clé (doit répondre « Version invalide. »)"
known=$(ssh-keygen -F "$server" 2>/dev/null | grep -v '^#' || true)
[[ -n $known ]] || known=$(ssh-keyscan -q -t ed25519 "$server")
printf '%s\n' "$known" >"$tmp/known_hosts"
out=$(ssh -i "$tmp/key" -o IdentitiesOnly=yes -o IdentityAgent=none -o UserKnownHostsFile="$tmp/known_hosts" \
    -o StrictHostKeyChecking=yes "deploy@$server" "test" 2>&1 </dev/null || true)
if [[ $out != *"Version invalide."* ]]; then
    echo "La clé ne fonctionne pas : $out" >&2
    echo "Vérifie que sshd accepte l'utilisateur deploy (AllowUsers / AllowGroups)." >&2
    exit 1
fi
echo "    ok"

echo "==> Secrets GitHub"
gh secret set DEPLOY_SSH_KEY <"$tmp/key"
gh secret set DEPLOY_HOST --body "deploy@$server"
gh secret set DEPLOY_KNOWN_HOSTS <"$tmp/known_hosts"
echo "Prêt : chaque fusion sur main sera déployée par GitHub Actions."
