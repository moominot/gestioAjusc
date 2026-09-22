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

## El camí d'importació bo: `.trn` + `.sco` + `.ini`

Els fitxers de text `.rnd` i `.stg` són una exportació parcial. El torneig de
debò viu en tres fitxers que el SwissPerfect desa sempre:

| Fitxer | Format | Contingut |
|---|---|---|
| `.trn` | dBase III | Participants: nom, cognoms, puntuació inicial, retirada |
| `.sco` | dBase III | Tots els resultats, amb la puntuació d'Scrabble |
| `.ini` | INI | Nom del torneig, organitzador, rondes previstes |

Comparat amb l'exportació de text, hi guanyem tres coses: **els noms dels
jugadors**, **la puntuació d'Scrabble** i **totes les rondes** sense dependre
que l'organitzador se'n recordi d'exportar-les. Al ManaCup, els `.rnd` porten 15
rondes de les 23 jugades; el `.sco` les porta totes.

### Les xifres van doblades

El SwissPerfect ho desa tot multiplicat per dos per treballar només amb enters:

- `W_SCORE`: 2 victòria, 1 empat, 0 derrota → dividiu per 2.
- `W_SUBSCO`: el doble de la puntuació d'Scrabble → dividiu per 2.

Comprovat: la primera partida del ManaCup hi consta 722–766, i al full de
l'AJUSC és 361–383.

### Altres detalls del format

- La codificació és **Windows-1252**, no la pàgina de codis DOS que solia fer
  servir el dBase. `Xurí` hi surt com a `58 75 72 ED`.
- El `.trn` acaba amb registres en blanc de reserva: al ManaCup n'hi ha 7 per a
  65 jugadors.
- `W_TYPE`/`B_TYPE` valen 1 quan la partida s'ha jugat. Les rondes ja
  aparellades però pendents hi consten amb tot a zero: al ManaCup, la 24 i la 25.
- `WITHDRAWAL` és la ronda a partir de la qual el jugador es retira. No afecta
  el càlcul, perquè el motor només mira les partides realment jugades.

El `.sco` i els `.rnd` s'han contrastat partida a partida: **450 coincidències,
cap discrepància**.

## Neteja de noms

`noms.ts` centralitza la normalització, i `scripts/genera_llavor.py` aplica les
mateixes regles. Treu els caràcters de format invisibles (`\p{Cf}`) i unifica
els separadors que no són l'espai normal (`\p{Zs}`), a més dels accents, el punt
volat i els apòstrofs tipogràfics per a la forma de comparació.

No és teòric: la llista del BARRUF porta un jugador amb un **WORD JOINER
(U+2060)** al davant del nom i uns quants amb espai al començament. Sense
netejar-ho, aquell jugador fallaria la coincidència exacta a cada importació.

Amb la neteja aplicada, dels **65 participants del ManaCup, 63 es resolen sols**
contra el registre. En queden dos per validar a mà: un cas genuïnament ambigu
(«Lluís Fuster» contra «Lluís Fuster Amer») i una alta nova.

## Resolució d'identitats

`resolucio.ts` va de les persones que surten a un fitxer de resultats als
jugadors del registre. És el punt delicat de tota la importació: una resolució
errònia no dona cap error, simplement atribueix les partides a qui no toca i mou
el BARRUF de dues persones.

Per això només resol sol el que és segur, en aquest ordre:

1. **Coincidència exacta** de la forma normalitzada amb el nom del registre.
2. **Àlies ja validat** per una persona en una importació anterior. És el que fa
   que el sistema aprengui: cada campionat en deixa de nous i el següent en
   demana menys.
3. Si no, **proposa candidats** perquè algú decideixi.

**Mai no resol sol per semblança**, per alta que sigui: «Lluís Fuster» i «Lluís
Fuster Amer» s'assemblen molt i podrien ser dues persones.

### La puntuació del fitxer com a corroboració

El `.trn` porta la puntuació amb què cada jugador entra al torneig, que sol ser
el seu BARRUF. No serveix de clau d'identitat —és la que tenia quan es va muntar
el torneig, i de 63 correspondències segures del ManaCup només 23 la
conserven— però quan un candidat és **l'únic del registre amb aquella
puntuació**, és la pista més forta de què disposem.

Al ManaCup passa exactament això: «Lluís Fuster» hi porta 1254 i l'únic jugador
del registre amb 1254 és «Lluís Fuster Amer». La resolució ho marca i posa el
candidat al davant, però la confirmació continua sent del gestor.

## Simulació

```
npm run simula -- <directori amb .trn, .sco i .ini>
```

Un campionat es barrufa **quan s'acaba**, mai per trams, i per això
`campionats.finalitzat` guarda la porta: la cadena es construeix amb
`computa_barruf AND finalitzat`. La simulació serveix per veure abans de
publicar què passarà, i per seguir un campionat en curs sense tocar res.
