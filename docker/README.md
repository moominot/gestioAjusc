# Rèplica per assajar

La pila sencera al servidor de casa, **només per a la xarxa local**. Serveix per
assajar les migracions abans d'aplicar-les a producció, provar importacions amb
dades de debò sense por, i tenir-hi una còpia de la base de dades.

No està pensat per exposar-ho a internet. Si algun dia ho voleu fer, no obriu
ports al router: feu servir un túnel de Cloudflare, que no deixa la IP de casa
a la vista i resol el certificat.

## Què hi ha

| Servei | Què fa |
|---|---|
| `bd` | PostgreSQL 16 |
| `auth` | Els enllaços d'entrada per correu (GoTrue, el mateix que Supabase) |
| `migracions` | Aplica les migracions noves de `supabase/migrations/` i es mor |
| `api` | PostgREST: el que hi ha darrere de `/rest/v1` |
| `correu` | Bústia de proves. Recull els correus i els ensenya; no en surt cap. |
| `porta` | Reparteix `/rest/v1` i `/auth/v1` entre els dos serveis |
| `aplicacio` | La mateixa aplicació que a Vercel, apuntant a aquesta rèplica |

La instal·lació oficial de Supabase en porta una desena: aquí no hi ha
emmagatzematge de fitxers, ni temps real, ni processament d'imatges, perquè
aquesta aplicació no en fa servir cap.

## Posar-ho en marxa

Al servidor, amb Docker i prou (no cal Node):

```bash
git clone https://github.com/moominot/gestioAjusc.git ~/ajusc
cd ~/ajusc/docker
./genera-claus.sh > .env      # contrasenyes, secret del JWT i la clau de l'aplicació
```

Obriu el `.env` i reviseu-hi l'adreça del servidor i els ports. Si algun ja és
ocupat per un altre servei, canvieu-lo **i també les URL que el porten**. Per
exemple, si l'API va al 8010, `URL_BASE` ha de dir `:8010`.

```bash
docker compose up -d --build
./comprova.sh
```

La primera vegada triga uns minuts: baixa les imatges i compila l'aplicació,
que en compilar passa les proves i la comprovació de tipus. Si fallen, no
arrenca.

| Què | On |
|---|---|
| L'aplicació | `http://<servidor>:3000` (`PORT_APLICACIO`) |
| La bústia de proves | `http://<servidor>:8025` (`PORT_CORREU`) |
| L'API, per al client de Supabase | `http://<servidor>:8000` (`PORT_API`) |
| La base de dades, per a psql | `<servidor>:5432` (`PORT_BD`) |

> El fitxer `.env` porta les contrasenyes. Està ignorat pel git; no el pugeu.

## Portar-hi la darrera versió

```bash
cd ~/ajusc
git pull
cd docker
docker compose up -d --build
```

Les migracions noves s'apliquen soles, i les que ja hi eren se salten: es porta
l'historial a `supabase_migrations.schema_migrations`, igual que Supabase.

## Comprovar que va

```bash
./comprova.sh
```

Ho mira tot —serveis, base de dades, funcions, API i permisos— i escriu un
informe. **No hi surt cap contrasenya**, de manera que es pot enganxar tal qual
per demanar ajuda:

```bash
./comprova.sh > informe.txt
```

Una línia que val la pena entendre: si diu **ALERTA DE SEGURETAT** vol dir que
un visitant anònim arriba a llegir la taula `jugadors`, que porta telèfons i
correus. Si passa, no ho exposeu enlloc fins a resoldre-ho.

## El primer gestor

Igual que a producció, cal entrar un cop perquè existeixi la fila a
`auth.users`:

1. Aneu a `http://<servidor>:3000/entrar`.
2. Demaneu l'enllaç amb el vostre correu.
3. **Obriu la bústia de proves a `http://<servidor>:8025`**: el correu és
   allà, no us arribarà enlloc més. Cliqueu-hi l'enllaç. Us tornarà a
   `/entrar`, perquè encara no sou gestor.
4. Afegiu-vos a `perfils`:

```bash
docker compose exec bd psql -U postgres -d ajusc -c \
  "INSERT INTO perfils (id, nom, rol) SELECT id, 'El vostre nom', 'admin' FROM auth.users WHERE email = 'el-vostre@correu.cat';"
```

5. Torneu a carregar `/gestio`.

Si demaneu dos enllaços seguits amb el mateix correu, el segon el refusa: hi
ha un minut d'espera entre enllaços, com a Supabase.

## Assajar una migració

És per a això que existeix la rèplica. Poseu la migració nova a
`supabase/migrations/` i:

```bash
docker compose up -d migracions
docker compose logs migracions
```

Només s'aplica la nova. Per assajar-les totes des de zero:

```bash
docker compose down -v          # esborra el volum i comença de zero
docker compose up -d
docker compose logs migracions
```

Si s'apliquen netes aquí, a producció també. I si peten, ha estat a casa.

## Portar-hi una còpia de producció

```bash
npx supabase db dump -f produccio.sql      # des de l'arrel del projecte
docker compose exec -T bd psql -U postgres -d ajusc < produccio.sql
```

Amb això assageu contra les dades de debò, que és quan surten els problemes que
no s'havien vist.

## Què s'ha provat

Tot, al servidor de casa (Ubuntu 26.04, Docker 29) i des de zero, el 23 de
setembre de 2026:

- Els set serveis arrenquen i es troben entre ells.
- Les cinc migracions s'apliquen en ordre, i en tornar a aixecar la pila se
  salten.
- `comprova.sh` surt net: 609 jugadors, 167 d'actius, l'anònim llegeix la
  classificació i xoca amb les dades de contacte.
- L'entrada per correu de punta a punta: el formulari, el correu a la bústia,
  l'enllaç, la sessió oberta i, un cop donat d'alta a `perfils`, la zona de
  gestió.

Si alguna cosa falla, els primers llocs on mirar:

```bash
docker compose ps                  # qui és dret i qui no
docker compose logs auth           # el GoTrue és el més primmirat
docker compose logs migracions     # si van petar, aquí diu on
docker compose logs aplicacio
```

Les etiquetes de les imatges són fixes, excepte la de la bústia. Si un dia n'heu
de canviar la del GoTrue, les vigents són a
`github.com/supabase/auth/releases`.
