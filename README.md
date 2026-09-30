# BARRUF — AJUSC

Rànquing de Scrabble clàssic en català de l'[AJUSC](https://www.ajuscrabble.cat),
i registre dels jugadors, clubs i campionats que el sostenen.

## Com està muntat

**Els resultats són l'única font de veritat; el BARRUF és una projecció
derivada.** Cap puntuació s'escriu mai a mà: es calcula rejugant la cadena de
campionats en ordre a partir d'una llavor. Corregir un resultat antic i tornar a
rejugar refà tota la història posterior sola.

| Peça | On és |
|---|---|
| Motor del BARRUF | [`lib/barruf/`](lib/barruf/README.md) |
| Importació de resultats | [`lib/importacio/`](lib/importacio/README.md) |
| Esquema i model de lectura | `supabase/migrations/` |
| Aplicació | `app/` (Next.js, App Router) |
| PDF del BARRUF | `lib/informe/`, servit a `/barruf/pdf?edicio=N` |

## Posar-ho en marxa

Per muntar el projecte de Supabase des de zero, vegeu
[`docs/desplegament.md`](docs/desplegament.md). Per aixecar una rèplica local
amb què assajar-ho tot abans, [`docker/README.md`](docker/README.md).

```bash
npm install
cp .env.example .env.local     # ompliu-hi les dades del projecte Supabase
npm run dev
```

Les migracions de `supabase/migrations/` s'apliquen en ordre. La llavor, el punt
de partida de la cadena, és l'edició 190. A sobre hi ha la temporada 2025-26
sencera (`…_temporada_2025_26.sql`): els 20 campionats partida per partida i
les edicions 191 a 210 rejugades amb el motor, que coincideixen jugador per
jugador amb els fulls de l'AJUSC. La genera `scripts/genera_temporada.ts`.

Abans de la llavor hi ha **l'arxiu**: les edicions 70 a 189 (temporades 2014-15
a 2024-25) tal com es van publicar, amb els seus 120 campionats
(`…_arxiu_2014_2025.sql`). No es rejuguen: la cadena arrenca de la llavor. Dels
campionats d'abans del 2018-19 només hi ha els aparellaments i les victòries
totals, no qui va guanyar cada partida. Es regenera així:

```bash
python3 scripts/extreu_arxiu.py <carpeta Temporades> <json>        # llegeix els fulls
pdftotext -layout <PDF d'una edició trencada> <json>/../pdfs/N.txt  # si cal
python3 scripts/llegeix_pdf_barruf.py <json> <pdfs>/*.txt
npx vite-node scripts/genera_arxiu.ts -- <json> 190 > supabase/migrations/…_arxiu.sql
```

```bash
npm test          # proves del motor i dels lectors
npm run typecheck
npm run simula -- <directori amb .trn, .sco i .ini>
```

## Seguretat

Dues capes independents, i totes dues han de deixar passar l'operació: els
privilegis diuen a quines taules arriba cada rol i l'RLS a quines files. Un
visitant anònim llegeix el que es publica i no accedeix a les dades de contacte
ni a les quotes ni en lectura. Escriure-hi només ho poden fer els gestors que
constin a `perfils`.

La clau que fa servir l'aplicació és la pública (`anon`), pensada per anar al
navegador. La clau de servei no ha d'aparèixer mai al codi.
