#!/bin/sh
# Aplica les migracions de supabase/migrations/ que encara no s'hagin aplicat.
#
# Porta l'historial a la mateixa taula que Supabase,
# supabase_migrations.schema_migrations, de manera que la rèplica es comporta
# igual que producció: cada migració s'aplica un sol cop, i tornar a aixecar la
# pila no les repeteix.
set -e

sql() { psql -h bd -U postgres -d ajusc -v ON_ERROR_STOP=1 -q "$@"; }

sql <<'SQL'
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version    text PRIMARY KEY,
    statements text[],
    name       text
);
SQL

for fitxer in /migracions/*.sql; do
	nom=$(basename "$fitxer" .sql)
	versio=${nom%%_*}
	ja=$(sql -tA -v versio="$versio" <<'SQL'
SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = :'versio';
SQL
)
	if [ "$ja" != "0" ]; then
		echo "    $nom (ja hi era)"
		continue
	fi

	echo "--> $nom"
	sql -f "$fitxer"
	sql -v versio="$versio" -v nom="${nom#*_}" <<'SQL'
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES (:'versio', :'nom');
SQL
done

echo "Migracions aplicades."
