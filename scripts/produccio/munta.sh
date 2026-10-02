#!/bin/sh
# Munta producció a Supabase a partir de la rèplica de tiny:
#
#   1. Esborra el que hi hagi a l'esquema public de Supabase (i els comptes
#      d'autenticació i l'historial de migracions vells).
#   2. Hi aplica totes les migracions, i les apunta a l'historial de Supabase
#      perquè `supabase db push` continuï des d'aquí.
#   3. Hi carrega les dades de la rèplica (bolca.sh + carrega.sql).
#   4. Compara les dues bases de dades (compara.sql).
#
# S'executa a tiny, des de la carpeta on hi ha aquests scripts:
#
#   DB_URL='postgresql://postgres.<ref>:<contrasenya>@<pooler>:5432/postgres' sh munta.sh
#
# Amb NOMES_DADES=1 se salta els passos 1 i 2 (per tornar a copiar les dades).
#
# Fa servir la «Session pooler» de Supabase, que funciona per IPv4.
set -e
: "${DB_URL:?Cal DB_URL, la cadena de connexió de Supabase (Session pooler)}"
AQUI=$(cd "$(dirname "$0")" && pwd)
MIGRACIONS=${MIGRACIONS:-$HOME/ajusc/supabase/migrations}
BOLCAT=${BOLCAT:-$HOME/bolcat}
# Abans de cap docker run: si no, Docker la crearia com a root.
mkdir -p "$BOLCAT"

# psql d'un contenidor: tiny no el té instal·lat.
psql_prod() {
  docker run --rm -i -v "$AQUI:/scripts:ro" -v "$BOLCAT:/bolcat:ro" -v "$MIGRACIONS:/migracions:ro" \
    -w /bolcat postgres:16-alpine psql "$DB_URL" -v ON_ERROR_STOP=1 -q "$@"
}

echo "== 0. Connexió"
psql_prod -At -c "SELECT current_user, version()"

if [ -z "$NOMES_DADES" ]; then
echo "== 1. Buidar"
psql_prod <<'SQL'
BEGIN;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
-- Els permisos que Supabase dona a l'esquema public d'un projecte nou.
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
-- Els comptes de l'aplicació vella: els bons es tornen a carregar a la 3.
DELETE FROM auth.users;
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, statements text[], name text);
TRUNCATE supabase_migrations.schema_migrations;
COMMIT;
SQL

echo "== 2. Migracions"
for f in "$MIGRACIONS"/*.sql; do
  nom=$(basename "$f" .sql)
  echo "   $nom"
  psql_prod -f "/migracions/$nom.sql" > /dev/null
  psql_prod -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${nom%%_*}', '${nom#*_}')"
done
fi

echo "== 3. Dades"
sh "$AQUI/bolca.sh" "$BOLCAT"
cp "$AQUI/carrega.sql" "$BOLCAT/"
psql_prod -f /bolcat/carrega.sql > /dev/null

echo "== 4. Comparació"
cd ~/ajusc/docker
docker compose exec -T bd psql -U postgres -d ajusc -At < "$AQUI/compara.sql" > /tmp/empremta-replica.txt
psql_prod -At -f /scripts/compara.sql > /tmp/empremta-produccio.txt
if diff /tmp/empremta-replica.txt /tmp/empremta-produccio.txt; then
  echo "Producció és idèntica a la rèplica."
else
  echo "ATENCIÓ: hi ha diferències (a dalt)."
  exit 1
fi
