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
