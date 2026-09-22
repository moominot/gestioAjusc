# Motor del BARRUF

Nucli de càlcul del rànquing de Scrabble clàssic en català de l'AJUSC.

## Principi rector

**Els resultats són l'única font de veritat. El BARRUF és una projecció derivada.**

Cap valor de BARRUF s'escriu mai a mà. Tot es recalcula rejugant la cadena de
campionats en ordre a partir d'una llavor. Corregir un resultat antic i tornar a
executar `rejugaCadena()` refà tota la història posterior sola.

Amb l'escala real de l'AJUSC —unes 700 fitxes de jugador i uns 45.000 resultats
individuals acumulats en 25 anys— rejugar la cadena sencera són mil·lisegons. No
cal cap memòria intermèdia ni cap optimització: es recalcula i punt.

## L'algorisme

Per cada jugador d'un campionat:

```
Eᵣ = Φ( (BarrufJugador − BarrufAdversariᵣ) / σ )      σ = 283,84
E  = Σ Eᵣ
K  = 20 si (partides_acumulades + partides_del_torneig) > 50, si no 30
Δ  = (Victòries_reals − E) × K
```

`Φ` és la normal acumulada. El BARRUF fa servir la normal, com l'Elo original de
la USCF, i no la logística de la FIDE o el Glicko. La σ de 283,84 és pràcticament
200·√2 ≈ 282,84, la dispersió de l'Elo clàssic.

Dues propietats que el codi manté i que les proves vigilen:

- **Totes les esperances es calculen amb els BARRUF d'abans del campionat.**
  Dins d'un mateix torneig ningú no juga contra una puntuació ja actualitzada.
- **Amb el mateix factor K per a tothom, un campionat suma zero.** El que un
  jugador guanya, un altre ho perd.

Un jugador nou entra amb **950**. Un BYE no és una partida jugada. Qui s'inscriu
i no juga cap partida no varia.

## Estats

```
partides = 0                              → nov
cohort de llegat (anterior al 2014-15)    → inact
partides ≤ 10                             → exp     (BARRUF provisional)
ha jugat dins les 2 darreres temporades   → act
altrament                                 → inact
```

L'ordre importa: **`exp` té prioritat sobre `inact`**. Un jugador provisional que
fa anys que no juga es queda en expectativa i no es desactiva mai, perquè mai ha
arribat a tenir un BARRUF ferm del qual retirar-lo.

La desactivació per inactivitat s'aplica **a l'inici de temporada, el setembre**,
no de manera contínua. Per reconstruir la llista tal com era en un moment del
passat cal replicar aquestes escombrades una per una.

Aquesta regla està validada contra els 609 jugadors del `GENERADOR_BARRUF`:
reprodueix els quatre estats sense cap excepció (`motor.test.ts`).

## Campionats d'arxiu

`campionats.computa_barruf` decideix si un campionat entra a la cadena.

L'AJUSC no conserva les partides dels 264 campionats històrics, de manera que la
cadena arrenca d'una **llavor**: els valors publicats a l'última edició del full
de càlcul, importats com a edició `es_llavor`. Els campionats anteriors que es
vagin recuperant s'importen amb `computa_barruf = false`: es poden consultar i
donen estadístiques i històric d'enfrontaments, però **no toquen cap BARRUF**.

Si algú posés un campionat d'arxiu a `true`, es recalcularia la cadena sencera i
es mourien tots els BARRUF publicats. `rejugaCadena()` només ha de rebre els
campionats que computen, ja ordenats per `(data, ordre)`.

## Procedència

Les constants i l'algorisme surten de la pestanya `DadesTorneig` del
`GENERADOR_BARRUF` de l'AJUSC: columnes `BO:CS` (esperança per ronda), `CT`
(esperança total), `CU` (factor K) i `CV` (variació). Les proves reprodueixen les
xifres d'un torneig real transcrit d'aquell full.

Les bases publicades són a https://www.ajuscrabble.cat/barruf/.

## Fitxers

| Fitxer | Contingut |
|---|---|
| `constants.ts` | σ, BARRUF inicial, llindars i factors K |
| `normal.ts` | Normal acumulada (Hart 1968, versió de West 2005) |
| `motor.ts` | Esperança, factor K, càlcul per campionat i rejugada de la cadena |
| `estats.ts` | Derivació de `nov` / `exp` / `act` / `inact` |
| `tipus.ts` | Tipus compartits |
| `motor.test.ts` | 35 proves, incloses les 609 files reals |

## La llavor

`supabase/migrations/20260922100200_llavor_barruf.sql` conté el punt zero: els 609
jugadors de l'edició 199, amb el seu BARRUF, les partides i victòries
acumulades, l'estat i el club. El genera `scripts/genera_llavor.py` a partir del
full, de manera que és reproduïble i no s'ha d'editar a mà.

La llavor porta les **partides acumulades**, no només el BARRUF. És
imprescindible: el factor K depèn del llindar de 50 partides, i sembrar-les a
zero faria que tothom anés amb K=30 per sempre.

Verificada contra el full: 609 jugadors × 11 camps = 6.699 valors, zero
discrepàncies.

## Avís sobre el canvi de temporada

L'escombrada d'inactivitat s'aplica **al setembre**. La llavor recull l'estat de
la temporada 2025-26; en entrar a la 2026-27, **16 jugadors passen d'`act` a
`inact`** perquè la seva darrera participació és del 2023-24.

Aquesta transició l'ha de fer l'aplicació explícitament en obrir la temporada, i
ha de quedar registrada com una edició nova. No és una conseqüència automàtica
de mirar el calendari: si algun dia es vol reconstruir la llista tal com era en
un moment del passat, cal poder replicar les escombrades una per una.

## Publicar una edició

`publicacio.ts` calcula una edició sencera: rejuga la cadena des de la llavor
amb tots els campionats barrufats, en deriva els estats i assigna les posicions.

No s'actualitza res de manera incremental. Es recalcula tot cada vegada, i per
això corregir un resultat antic i tornar a publicar refà tota la història
posterior sola.

**La temporada de referència importa.** És des d'on es mira qui fa dues
temporades que no juga, i com que l'escombrada d'inactivitat s'aplica a l'inici
de temporada, publicar amb una temporada o una altra dona llistes diferents.
Això és volgut, i la pantalla de publicació ho demana explícitament.

Les posicions segueixen el criteri de sempre: els empatats la comparteixen i la
següent se salta tantes places com empats hi hagi. Només en tenen els actius.

### Què es reescriu i què no

| | En publicar |
|---|---|
| `barruf_edicions` i els seus `barruf_valors` | S'hi afegeix l'edició nova. Les anteriors **no es toquen mai**: són el que es va publicar en el seu moment. |
| `barruf_variacions` | Es reescriuen senceres. Són una projecció del càlcul actual, no un registre històric. |

### Comprovat de punta a punta

Amb el ManaCup importat i marcat com a finalitzat, la publicació del BARRUF 200
dona exactament les xifres de `npm run simula`, que al seu dia es van contrastar
amb una implementació independent en Python. En Xisco Truyols passa de 1343 a
1403 —21 victòries de 23 contra les 18 esperades, amb K=20— i esdevé el primer
Gran Gran Mestre de la llista.
