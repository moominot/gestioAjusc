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
| `migracions` | Aplica `supabase/migrations/` i es mor. Feina d'un sol cop. |
| `api` | PostgREST: el que hi ha darrere de `/rest/v1` |
| `correu` | Bústia de proves. Recull els correus i els ensenya; no en surt cap. |
| `porta` | Reparteix `/rest/v1` i `/auth/v1` entre els dos serveis |

Són sis. La instal·lació oficial de Supabase en porta una desena: aquí no hi ha
emmagatzematge de fitxers, ni temps real, ni processament d'imatges, perquè
aquesta aplicació no en fa servir cap.

## Posar-ho en marxa

```bash
cd docker
./genera-claus.sh > .env      # contrasenyes, secret del JWT i la clau de l'aplicació
docker compose up -d
docker compose logs -f migracions
```

Quan el registre digui `Migracions aplicades`, ja hi és tot.

El `.env` porta comentada, al final, la configuració per al `.env.local` de
l'aplicació. Descomenteu-la, poseu-hi l'adreça del vostre servidor i copieu-la.

> El fitxer `.env` porta les contrasenyes. Està ignorat pel git; no el pugeu.

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

1. Aixequeu l'aplicació apuntant a la rèplica i aneu a `/entrar`.
2. Demaneu l'enllaç amb el vostre correu.
3. **Obriu la bústia de proves a `http://<el-servidor>:8025`**: el correu és
   allà, no us arribarà enlloc més. Cliqueu-hi l'enllaç.
4. Afegiu-vos a `perfils`:

```bash
docker compose exec bd psql -U postgres -d ajusc -c \
  "INSERT INTO perfils (id, nom, rol) SELECT id, 'El vostre nom', 'admin' FROM auth.users;"
```

## Assajar una migració

És per a això que existeix la rèplica:

```bash
docker compose down -v          # esborra el volum i comença de zero
docker compose up -d
docker compose logs -f migracions
```

Si s'apliquen netes aquí, a producció també. I si peten, ha estat a casa.

## Portar-hi una còpia de producció

```bash
supabase db dump -f produccio.sql          # des de l'arrel del projecte
docker compose exec -T bd psql -U postgres -d ajusc < produccio.sql
```

Amb això assageu contra les dades de debò, que és quan surten els problemes que
no s'havien vist.

## Què hi ha provat i què no

Aquesta és la part del projecte que **no he pogut executar sencera**: l'entorn
on es va escriure no deixa baixar imatges de contenidor. El que sí que s'ha
comprovat contra un PostgreSQL de debò:

- El guió d'inicialització: els rols, l'esquema `auth` i les funcions
  `auth.uid()`, `auth.jwt()` i `auth.role()`.
- Les cinc migracions aplicades al damunt, en ordre.
- PostgREST amb el rol `autenticador` i la clau que genera `genera-claus.sh`,
  amb la mateixa configuració que el compose (`db-use-legacy-gucs = false`):
  un visitant anònim llegeix la classificació i xoca amb les dades de contacte;
  un gestor llegeix els jugadors i `auth.uid()` el reconeix; un usuari
  identificat que no és gestor no veu res i no pot importar.
- La sintaxi del `compose.yml` i l'ordre de dependències.

El que **no** s'ha pogut provar: que les imatges arrenquin i es trobin entre
elles, que el GoTrue creï bé les seves taules abans que corrin les migracions,
i el repartiment de rutes del Caddy. Si alguna cosa falla, serà per aquí.

Els primers llocs on mirar:

```bash
docker compose ps                  # qui és dret i qui no
docker compose logs auth           # el GoTrue és el més primmirat
docker compose logs migracions     # si van petar, aquí diu on
```

Les etiquetes de totes les imatges s'han comprovat contra el registre i
existeixen, inclosa la del GoTrue (`v2.197.0`, l'última estable). Si un dia
n'hagueu de canviar cap, les vigents són a `github.com/supabase/auth/releases`.
