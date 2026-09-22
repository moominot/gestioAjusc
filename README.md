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

## Posar-ho en marxa

Per muntar el projecte de Supabase des de zero, vegeu
[`docs/desplegament.md`](docs/desplegament.md). Per aixecar una rèplica local
amb què assajar-ho tot abans, [`docker/README.md`](docker/README.md).

```bash
npm install
cp .env.example .env.local     # ompliu-hi les dades del projecte Supabase
npm run dev
```

Les cinc migracions de `supabase/migrations/` s'apliquen en ordre. La segona és
la llavor: els 609 jugadors de l'edició 199, importats del full de càlcul.

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
