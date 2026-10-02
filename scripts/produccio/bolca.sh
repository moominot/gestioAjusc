#!/bin/sh
# Bolca les dades de la rèplica de tiny per carregar-les en una altra base de
# dades amb el mateix esquema (producció a Supabase, o una base de proves).
#
# S'executa a tiny:   sh bolca.sh [carpeta de sortida]
#
# Deixa dos fitxers:
#   dades.sql     totes les dades de l'esquema public (sense l'esquema: aquest
#                 surt de les migracions)
#   usuaris.sql   els comptes dels gestors (auth.users i auth.identities), amb
#                 la contrasenya xifrada, perquè hi puguin entrar igual
set -e
SORTIDA=${1:-$HOME/bolcat}
mkdir -p "$SORTIDA"
cd ~/ajusc/docker

docker compose exec -T bd pg_dump -U postgres -d ajusc \
  --data-only --schema=public --no-owner --no-privileges > "$SORTIDA/dades.sql"

# Només les columnes que hi ha a totes les versions del servidor d'autenticació.
docker compose exec -T bd psql -U postgres -d ajusc -At <<'SQL' > "$SORTIDA/usuaris.sql"
SELECT format(
  'INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, '
  'raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, '
  'email_change_token_new, email_change) VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, '''', '''', '''', '''') '
  'ON CONFLICT (id) DO NOTHING;',
  u.instance_id, u.id, u.aud, u.role, u.email, u.encrypted_password, u.email_confirmed_at,
  u.raw_app_meta_data, u.raw_user_meta_data, u.created_at, u.updated_at)
FROM auth.users u WHERE u.id IN (SELECT id FROM public.perfils);
SELECT format(
  'INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at) '
  'SELECT %L, %L, %L, %L, %L, %L WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE provider = %L AND provider_id = %L);',
  i.provider_id, i.user_id, i.identity_data, i.provider, i.created_at, i.updated_at, i.provider, i.provider_id)
FROM auth.identities i WHERE i.user_id IN (SELECT id FROM public.perfils);
SQL

echo "Bolcat a $SORTIDA: $(wc -c < "$SORTIDA/dades.sql") bytes de dades, $(grep -c 'INSERT INTO auth.users' "$SORTIDA/usuaris.sql") gestors"
