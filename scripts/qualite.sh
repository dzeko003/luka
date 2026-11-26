#!/usr/bin/env bash
# Examen qualité de Luka : base PostgreSQL jetable, migrations, puis qualite/lancer.mts.
# Les collectes appellent les vrais services (IA, recherche web, OpenAlex, OpenStreetMap) avec les clés de .env.local.
# Aucun e-mail n'est envoyé. Usage : npm run qualite [-- --cas=id1,id2] [-- --forme=lieux] [-- --premium]
set -euo pipefail
cd "$(dirname "$0")/.."
name=luka-qualite
port=55440
docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --rm --name "$name" -e POSTGRES_USER=luka -e POSTGRES_PASSWORD=luka -e POSTGRES_DB=luka_qualite \
    -p "127.0.0.1:$port:5432" postgres:17-alpine >/dev/null
trap 'docker stop "$name" >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 30); do docker exec "$name" pg_isready -U luka -d luka_qualite >/dev/null 2>&1 && break; sleep 1; done
sleep 1
export DATABASE_URL="postgres://luka:luka@127.0.0.1:$port/luka_qualite"
node scripts/migrate.mjs >/dev/null
# SMTP_HOST vide : aucun e-mail envoyé ; APIFY_TOKEN vide sauf --premium (Google Maps est payant)
smtp="" apify=""
if [[ " $* " == *" --premium "* ]]; then apify=$(sed -n 's/^APIFY_TOKEN=//p' .env.local 2>/dev/null || true); fi
# Limites vides : les valeurs par défaut des formules s'appliquent, pas celles de .env.local (souvent relevées pour développer)
limits=(FREE_COLLECTES_PER_DAY FREE_MAX_ROWS FREE_MAX_QUERIES FREE_MAX_ENRICH_SITES FREE_MAX_REVERSE_GEOCODE FREE_MAX_ENRICH_ROWS
    FREE_MAX_CONTACT_SEARCHES PREMIUM_COLLECTES_PER_DAY PREMIUM_MAX_ROWS PREMIUM_MAX_QUERIES PREMIUM_MAX_ENRICH_SITES
    PREMIUM_MAX_REVERSE_GEOCODE PREMIUM_MAX_ENRICH_ROWS PREMIUM_MAX_CONTACT_SEARCHES GLOBAL_LLM_CALLS_PER_DAY)
for v in "${limits[@]}"; do export "$v="; done
SMTP_HOST="$smtp" APIFY_TOKEN="$apify" NODE_ENV=production npx tsx qualite/lancer.mts "$@"
