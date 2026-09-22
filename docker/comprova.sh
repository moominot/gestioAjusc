#!/bin/sh
# Diagnòstic de la rèplica.
#
# Ho comprova tot i escriu un informe que es pot enganxar tal qual per demanar
# ajuda. No hi surt cap contrasenya ni cap clau sencera.
#
#   ./comprova.sh
#   ./comprova.sh > informe.txt

cd "$(dirname "$0")" || exit 1

titol() { printf '\n=== %s ===\n' "$1"; }
be()    { printf '  [bé]    %s\n' "$1"; }
malam() { printf '  [MAL]   %s\n' "$1"; }
nota()  { printf '          %s\n' "$1"; }

printf 'Informe de la rèplica del BARRUF — %s\n' "$(date '+%Y-%m-%d %H:%M')"

# -----------------------------------------------------------------------------
titol 'Entorn'
if command -v docker >/dev/null 2>&1; then
	be "docker $(docker --version 2>/dev/null | sed 's/Docker version //;s/,.*//')"
else
	malam 'no hi ha docker'
	exit 1
fi
docker compose version >/dev/null 2>&1 && be "compose $(docker compose version --short 2>/dev/null)" ||
	malam 'no hi ha el connector compose'

if [ -f .env ]; then
	be '.env existeix'
	for clau in CONTRASENYA_BD CONTRASENYA_AUTENTICADOR SECRET_JWT URL_BASE URL_APLICACIO; do
		grep -q "^$clau=" .env && be "$clau definida" || malam "falta $clau al .env"
	done
else
	malam 'falta el .env — executeu ./genera-claus.sh > .env'
	exit 1
fi

# -----------------------------------------------------------------------------
titol 'Serveis'
docker compose ps --format 'table {{.Service}}\t{{.Status}}' 2>&1 | sed 's/^/  /'

for servei in bd auth api porta correu; do
	estat=$(docker compose ps --status running --services 2>/dev/null | grep -cx "$servei")
	[ "$estat" = 1 ] || malam "el servei «$servei» no està dret"
done

sortida=$(docker compose ps -a --format '{{.Service}} {{.ExitCode}}' 2>/dev/null | grep '^migracions ')
case "$sortida" in
	'migracions 0') be 'les migracions van acabar bé' ;;
	'') nota 'les migracions encara no han corregut' ;;
	*) malam "les migracions van sortir amb $(echo "$sortida" | awk '{print $2}')" ;;
esac

# -----------------------------------------------------------------------------
titol 'Base de dades'
consulta() { docker compose exec -T bd psql -U postgres -d ajusc -t -A -c "$1" 2>&1 | tr -d '\r'; }

jugadors=$(consulta 'SELECT count(*) FROM jugadors;')
case "$jugadors" in
	609) be '609 jugadors: la llavor hi és sencera' ;;
	''|*[!0-9]*) malam "no puc consultar la base de dades: $(echo "$jugadors" | head -1 | cut -c1-90)" ;;
	*) malam "hi ha $jugadors jugadors, n'hi hauria d'haver 609" ;;
esac

actius=$(consulta "SELECT count(*) FROM barruf_classificacio WHERE estat='act';")
case "$actius" in
	''|*[!0-9]*) malam 'la vista de la classificació no respon' ;;
	*) be "$actius jugadors actius" ;;
esac

taules=$(consulta "SELECT count(*) FROM information_schema.tables WHERE table_schema='auth';")
case "$taules" in
	''|*[!0-9]*|0) malam "l'esquema auth és buit: el GoTrue no ha creat les seves taules" ;;
	*) be "l'esquema auth té $taules taules" ;;
esac

for funcio in 'auth.uid()' 'auth.jwt()' 'es_gestor()'; do
	consulta "SELECT $funcio IS NOT NULL OR TRUE;" | grep -q '^t$' &&
		be "$funcio respon" || malam "$funcio no existeix o peta"
done

gestors=$(consulta 'SELECT count(*) FROM perfils;')
case "$gestors" in
	0) nota "cap gestor donat d'alta encara (vegeu el README)" ;;
	''|*[!0-9]*) malam 'no puc llegir perfils' ;;
	*) be "$gestors gestors donats d'alta" ;;
esac

# -----------------------------------------------------------------------------
titol 'API'
port=$(grep '^PORT_API=' .env 2>/dev/null | cut -d= -f2)
port=${port:-8000}
base="http://localhost:$port"

# La clau anon surt del comentari que deixa genera-claus.sh al .env.
clau=$(grep 'NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env 2>/dev/null | sed 's/.*ANON_KEY=//' | tr -d '\r')
if [ -z "$clau" ]; then
	malam "no trobo la clau anon al .env; les proves de l'API se salten"
else
	be "clau anon trobada (acaba en …$(printf '%s' "$clau" | tail -c 6))"

	codi=$(curl -s -o /tmp/ajusc-prova -w '%{http_code}' \
		"$base/rest/v1/barruf_classificacio?estat=eq.act&limit=1&select=nom_complet" \
		-H "Authorization: Bearer $clau" 2>/dev/null)
	if [ "$codi" = 200 ] && grep -q nom_complet /tmp/ajusc-prova 2>/dev/null; then
		be 'un visitant anònim llegeix la classificació'
	elif [ "$codi" = 000 ]; then
		malam "no arribo a $base — la porta d'entrada no respon"
	else
		malam "la classificació respon $codi"
		nota "$(head -c 160 /tmp/ajusc-prova 2>/dev/null)"
	fi

	codi=$(curl -s -o /tmp/ajusc-prova -w '%{http_code}' "$base/rest/v1/jugadors?limit=1" \
		-H "Authorization: Bearer $clau" 2>/dev/null)
	if [ "$codi" = 000 ]; then
		nota "no arribo a l'API: la prova de permisos se salta"
	elif [ "$codi" = 401 ] || [ "$codi" = 403 ] || grep -q 'permission denied' /tmp/ajusc-prova 2>/dev/null; then
		be 'les dades de contacte estan tancades'
	else
		malam "ALERTA DE SEGURETAT: /jugadors respon $codi a un visitant anònim"
		nota 'hauria de dir permission denied. No exposeu això enlloc fins a resoldre-ho.'
	fi

	codi=$(curl -s -o /dev/null -w '%{http_code}' "$base/auth/v1/health" 2>/dev/null)
	[ "$codi" = 200 ] && be "l'autenticació respon" || malam "/auth/v1/health respon $codi"
fi
rm -f /tmp/ajusc-prova

# -----------------------------------------------------------------------------
titol 'Registres dels serveis que no van'
for servei in bd auth migracions api porta; do
	dret=$(docker compose ps --status running --services 2>/dev/null | grep -cx "$servei")
	codi=$(docker compose ps -a --format '{{.Service}} {{.ExitCode}}' 2>/dev/null |
		awk -v s="$servei" '$1==s {print $2}')
	if [ "$dret" != 1 ] && [ "$codi" != 0 ]; then
		printf '\n--- %s ---\n' "$servei"
		docker compose logs --tail 25 --no-color "$servei" 2>&1 | sed 's/^/  /'
	fi
done

printf '\nFi de l informe.\n'
