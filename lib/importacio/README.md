# Importació de resultats

## El format del SwissPerfect

Els organitzadors fan servir SwissPerfect, que exporta un fitxer per ronda i un
per classificació. Tots dos són text delimitat per barres verticals amb
capçalera.

**`<torneig>.<ronda>.rnd`** — les partides d'una ronda. És l'única font de
veritat.

```
ROUND|TABLE_NO|WHITE_ID|BLACK_ID|WHITE_SCORE|BLACK_SCORE
1|1|40|43|0|1
```

**`<torneig>.<ronda>.stg`** — la classificació. Només per contrastar.

```
PLACING|SHORT_PLACING|PLAYER_ID|TOTAL_SCORE|TB_NUMBER_OF_WINS|TB_MED_BUCHHOLZ|TB_BUCHHOLZ|TB_BERGER||
1|1-5|1|17.0|17|191.5|210.5|142.00||
```

## El que hem après del ManaCup 2025-26

Quatre coses que el codi dona per fetes perquè s'han comprovat amb els fitxers
reals del campionat:

**Els resultats són punts de partida, no puntuació d'Scrabble.** Només 1, 0 i
0,5. Els `.rnd` no porten enlloc els punts de la partida. Per al BARRUF n'hi ha
prou, però vol dir que les estadístiques de puntuació s'han d'omplir per una
altra via.

**No hi ha cap marca de BYE.** Qui descansa, simplement no surt a la ronda. Va
bé, perquè per al BARRUF un descans tampoc no és una partida jugada.

**Hi ha inscrits que no juguen mai.** Al ManaCup, sis dels 65 surten a la
classificació amb zero punts i zero partides, i dos d'ells no apareixen a cap
ronda. El motor ja els contempla: qui no juga no varia.

**El número del nom del fitxer menteix.** El fitxer `ManaCup_25-26.21.stg` conté
la classificació de **19** rondes, no de 21: reparteix 570 punts i les taules
són de 30. Per això `dedueixRondesCobertes()` ho calcula a partir del total i el
codi no es refia mai del nom.

## Límit del contrast

`contrastaAmbClassificacio()` compara totals. Amb l'exportació sencera quadra al
punt i qualsevol resultat capgirat surt. Amb rondes absents la tolerància és
d'un punt per ronda que falta, i un sol resultat capgirat hi cap de sobres.

Serveix per enxampar desquadraments grossos, no per auditar resultat a resultat.
Les proves cobreixen tots dos escenaris perquè el límit quedi documentat.

## El que encara falta

**Els noms dels jugadors.** Els `.rnd` i els `.stg` només porten un
`PLAYER_ID` numèric que val per a aquell torneig i prou: el jugador 40 del
ManaCup no té res a veure amb el jugador 40 de cap altre campionat.

Sense la correspondència entre aquests números i els noms no es pot importar
res, perquè no hi ha manera d'enllaçar-los amb el registre de l'AJUSC. Cal el
fitxer principal del SwissPerfect (`.TRN`) o una exportació de la llista de
participants.

Un cop hi hagi els noms, la cadena és: nom del fitxer → `jugador_alies` →
`nameMatching` per als que no hi constin → validació manual dels dubtosos →
identificador del registre. I cada nom validat s'hi desa com a àlies, de manera
que la propera importació d'aquell club ja el reconeixerà.
