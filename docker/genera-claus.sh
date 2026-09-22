#!/bin/sh
# Genera el fitxer .env de la rèplica: contrasenyes, secret del JWT i les claus
# que fa servir l'aplicació.
#
# Les claus són JWT signats amb el mateix secret que valida PostgREST, igual que
# fa Supabase. Sense això, l'API rebutjaria totes les peticions.
#
#   ./genera-claus.sh > .env
set -e

aleatori() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

SECRET=$(aleatori)
CONTRASENYA_BD=$(aleatori)
CONTRASENYA_AUTENTICADOR=$(aleatori)

# JWT HS256 amb només les eines de sempre.
jwt() {
	capcalera=$(printf '{"alg":"HS256","typ":"JWT"}' | base64 | tr '+/' '-_' | tr -d '=\n')
	carrega=$(printf '%s' "$1" | base64 | tr '+/' '-_' | tr -d '=\n')
	signatura=$(printf '%s.%s' "$capcalera" "$carrega" |
		openssl dgst -binary -sha256 -hmac "$SECRET" |
		base64 | tr '+/' '-_' | tr -d '=\n')
	printf '%s.%s.%s' "$capcalera" "$carrega" "$signatura"
}

# Caduquen d'aquí a deu anys: és una rèplica de proves, no producció.
CADUCITAT=$(($(date +%s) + 315360000))

cat <<FI
# Generat per docker/genera-claus.sh. No el pugeu al repositori.

CONTRASENYA_BD=$CONTRASENYA_BD
CONTRASENYA_AUTENTICADOR=$CONTRASENYA_AUTENTICADOR
SECRET_JWT=$SECRET

# Adreça del servidor a la xarxa local. Canvieu-la per la vostra.
URL_BASE=http://192.168.178.122:8000
URL_APLICACIO=http://192.168.178.122:3000
URLS_PERMESES=http://192.168.178.122:3000/auth/retorn,http://localhost:3000/auth/retorn

PORT_API=8000
PORT_BD=5432
PORT_CORREU=8025

# ---------------------------------------------------------------------------
# Per al .env.local de l'aplicació
# ---------------------------------------------------------------------------
# NEXT_PUBLIC_SUPABASE_URL=http://192.168.178.122:8000
# NEXT_PUBLIC_SUPABASE_ANON_KEY=$(jwt '{"role":"anon","iss":"ajusc","aud":"authenticated","exp":'"$CADUCITAT"'}')
# NEXT_PUBLIC_URL_BASE=http://192.168.178.122:3000
FI
