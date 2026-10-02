# API del BARRUF (v1)

Pont entre el BARRUF i altres aplicacions, per exemple la que gestiona els
aparellaments, els resultats i la classificació d'un campionat.

- **Llegir** el registre de jugadors i la classificació del BARRUF: públic, sense clau.
- **Enviar** els resultats d'un campionat: amb la clau de l'aplicació. El que
  s'envia **no es publica directament**: queda pendent fins que un gestor el
  revisa i l'importa.

Adreça base: `https://<domini del BARRUF>/api/v1` (ara mateix, la rèplica:
`https://classificat-home.taile04fba.ts.net/api/v1`). Totes les respostes són
JSON en UTF-8, i s'hi pot accedir des d'una web d'un altre domini (CORS obert).

## Llegir

### `GET /api/v1/barruf`

La classificació de l'última edició publicada.

```json
{
  "edicio": 211,
  "data": "2026-10-02",
  "temporada": "2026-27",
  "jugadors": [
    { "posicio": 1, "numero": 230, "nom": "Maribel Servera", "club": "Manacor",
      "barruf": 1439, "categoria": "Gran Gran Mestre", "estat": "act",
      "partides": 423, "victories": 314.5, "darrera_temporada": "2025-26" }
  ]
}
```

`estat`: `act` (actiu, amb posició), `exp` (en expectativa, 10 partides o
menys), `inact` (inactiu), `nov` (inscrit sense partides). Només els actius
tenen `posicio`.

### `GET /api/v1/jugadors`

Tot el registre, amb el BARRUF actual de cadascú (si en té):

```json
[
  { "numero": 608, "nom": "Bel Miquel", "club": "Manacor",
    "barruf": 1008, "categoria": "Avançat", "estat": "act", "posicio": 97,
    "partides": 54, "victories": 23, "darrera_temporada": "2025-26",
    "alies": ["Bel Miquel Cazorla"], "numeros_fusionats": [582] }
]
```

- **`numero`** és l'identificador del jugador al BARRUF. És el que convé
  guardar a l'aplicació i tornar a enviar amb els resultats.
- **`alies`**: altres maneres com ha aparegut escrit el nom en campionats
  anteriors. Serveixen per reconèixer un jugador quan s'inscriu.
- **`numeros_fusionats`**: números antics d'aquest jugador (fitxes duplicades
  que s'han unit). Si l'aplicació en té guardat algun, val igual.

### `GET /api/v1/jugadors/{numero}`

Un sol jugador, amb el mateix format. Un número fusionat torna el jugador on
es va fusionar. `404` si no existeix.

Aquestes dades es poden guardar un minut en memòria cau.

## Enviar els resultats d'un campionat

Cal una clau. La crea un gestor a **Gestió › Connexions** (només es veu en
crear-la). Va a la capçalera de cada petició:

```
Authorization: Bearer barruf_…
```

### `POST /api/v1/campionats`

```json
{
  "id_extern": "obert-manacor-2026",
  "campionat": {
    "nom": "VI Obert de Manacor",
    "data": "2026-11-14",
    "organitzador": "CS Manacor",
    "club_organitzador": "Manacor",
    "rondes_previstes": 7,
    "acabat": true,
    "dades": { "lloc": "Casal de Cultura", "arbitre": "…" }
  },
  "participants": [
    { "id": "1", "nom": "Maribel Servera", "numero": 230 },
    { "id": "2", "nom": "Joan Pascual", "numero": 144 },
    { "id": "3", "nom": "Jugadora Nova" }
  ],
  "partides": [
    { "ronda": 1, "jugador_1": "1", "jugador_2": "2", "punts_1": 456, "punts_2": 398,
      "scrabbles_1": 3, "scrabbles_2": 1,
      "mot_1": "QUIQUIRIQUIC", "punts_mot_1": 98,
      "mot_lletra_2": "XINXETA", "punts_lletra_2": 44,
      "dades": { "full": "https://…/r1-t1.jpg", "tauler": "https://…/r1-t1-tauler.jpg",
                 "taula": 1, "hora": "10:00", "comentaris": "…" } },
    { "ronda": 1, "jugador_1": "3", "jugador_2": null }
  ]
}
```

**El campionat**

| Camp | | |
|---|---|---|
| `id_extern` | obligatori | L'identificador del campionat a la vostra aplicació. Si s'envia més d'un cop, la versió nova substitueix l'anterior. |
| `campionat.nom` | obligatori | |
| `campionat.data` | obligatori | `AAAA-MM-DD`, el primer dia. |
| `campionat.organitzador`, `club_organitzador` | opcionals | El club, amb el nom curt del BARRUF si se sap (Manacor, MiMaM, Delta Prat…). |
| `campionat.rondes_previstes` | opcional | |
| `campionat.acabat` | opcional | `true` si ja s'ha jugat l'última ronda. El gestor ho confirma en revisar-lo. |
| `campionat.dades` | opcional | Objecte lliure. |

**Els participants**: `id` (el vostre identificador dins del torneig; les
partides el citen), `nom` i, si el sabeu, `numero` del BARRUF. Sense
`numero`, el gestor decidirà si és un jugador del registre (amb un altre nom)
o una alta nova.

**Les partides**

| Camp | | |
|---|---|---|
| `ronda` | obligatori | Des de 1. Un jugador només pot tenir una partida per ronda. |
| `jugador_1`, `jugador_2` | obligatori | Els `id` dels participants. `jugador_2: null` vol dir que el jugador 1 descansa (compta com a victòria). |
| `punts_1`, `punts_2` | | La puntuació. Si hi és, el resultat es dedueix: guanya qui en fa més. |
| `resultat_1` | | Només si no hi ha puntuació: `1`, `0.5` o `0` per al jugador 1. |
| `scrabbles_1`, `scrabbles_2` | opcionals | |
| `mot_1`, `punts_mot_1`, `mot_2`, `punts_mot_2` | opcionals | La millor jugada de cada jugador. |
| `mot_lletra_1`, `punts_lletra_1`, `mot_lletra_2`, `punts_lletra_2` | opcionals | La millor jugada amb lletra especial (Ç, L·L, NY, Q, X…). |
| `dades` | opcional | Objecte lliure, fins a 10.000 caràcters. |

**Dades lliures** (`dades`): qualsevol objecte JSON. La fitxa del campionat
mostra amb nom aquests camps, i els enllaços com a enllaços:

| Camp | Què és |
|---|---|
| `full` | Enllaç a la imatge del full d'anotacions. |
| `tauler` | Enllaç a la imatge del tauler final. |
| `taula` | Número de taula. |
| `lloc` | On s'ha jugat. |
| `hora` | Hora d'inici. |
| `comentaris` | Text lliure. |

Els altres camps es desen i es mostren tal com vénen.

**Respostes**

- `202`: rebut i pendent de revisió.
  ```json
  { "id": "…", "id_extern": "obert-manacor-2026", "versio": 1, "estat": "pendent",
    "campionat_id": null, "missatge": "Rebut. Queda pendent que un gestor el revisi i l’importi." }
  ```
- `401`: sense clau, o clau no vàlida o revocada.
- `422`: dades no vàlides, amb la llista de tots els errors trobats:
  ```json
  { "error": "Les dades no són vàlides.",
    "errors": ["campionat.data: ha de ser AAAA-MM-DD",
               "partides[4]: «a» ja té una partida a la ronda 1"] }
  ```
- `400` (no és JSON) i `413` (més de 5 MB).

Es pot enviar a mig torneig i tornar-ho a fer al final: cada enviament és una
versió nova del mateix `id_extern` i torna a quedar pendent. Si una versió
anterior ja s'havia importat, en revisar la nova es reimporta sobre el mateix
campionat.

### `GET /api/v1/campionats/{id_extern}`

En quin punt és un campionat enviat per aquesta mateixa aplicació:

```json
{ "id_extern": "obert-manacor-2026", "versio": 2, "estat": "importada",
  "rebuda_el": "…", "actualitzada_el": "…", "revisada_el": "…",
  "campionat_id": "…", "finalitzat": true, "barruf": 212,
  "enllac": "https://…/campionats/…" }
```

`estat`: `pendent`, `importada` o `descartada`. `barruf` és l'edició del
BARRUF on ha entrat el campionat (o `null` si encara no s'hi ha publicat).

## Què passa a l'altra banda

1. L'enviament arriba a **Gestió › Importacions rebudes**.
2. Un gestor l'obre amb l'importador de sempre: els jugadors amb `numero`
   ja surten associats; els altres es miren contra el registre (nom, àlies,
   semblança) i el gestor decideix si són algú del registre o una alta nova.
3. En importar-lo, el campionat queda desat. Si està acabat i computa, entra
   a la propera publicació del BARRUF.
