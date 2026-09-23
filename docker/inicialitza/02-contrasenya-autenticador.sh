#!/bin/sh
# Posa a `autenticador` la contrasenya del .env, que és amb la que s'hi
# connecta PostgREST. L'SQL d'abans no pot llegir variables d'entorn, i per
# això el crea amb una de provisional.
set -e

if [ -z "$CONTRASENYA_AUTENTICADOR" ]; then
	echo "Falta CONTRASENYA_AUTENTICADOR: l'API no s'hi podrà connectar." >&2
	exit 1
fi

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
	-v contrasenya="$CONTRASENYA_AUTENTICADOR" <<'SQL'
ALTER ROLE autenticador PASSWORD :'contrasenya';
SQL
