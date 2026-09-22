#!/usr/bin/env python3
"""
Genera la migració de la llavor del BARRUF a partir del GENERADOR_BARRUF.

L'AJUSC no conserva les partides dels 264 campionats històrics, de manera que la
cadena no es pot rejugar des de l'origen. En comptes d'això arrenca d'una
llavor: els valors publicats a la darrera edició del full de càlcul, importats
com a edició `es_llavor`.

És important que la llavor porti també les partides acumulades de cada jugador i
no només el BARRUF, perquè el factor K depèn del llindar de 50 partides. Si es
sembrés a zero, tothom aniria amb K=30 per sempre.

Ús:
    python3 scripts/genera_llavor.py GENERADOR_BARRUF.xlsx \\
        > supabase/migrations/0002_llavor_barruf.sql

    python3 scripts/genera_llavor.py GENERADOR_BARRUF.xlsx --json \\
        > lib/importacio/__fixtures__/registre-llavor.json
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from datetime import date

import openpyxl

# Edició publicada que recull el full. Cel·la INICI!B6.
EDICIO_LLAVOR = 199
TEMPORADA_LLAVOR = "2025-26"

# Temporades que cal donar d'alta perquè les claus foranes resolguin.
PRIMERA_TEMPORADA = 2014
DARRERA_TEMPORADA = 2026

COLUMNES = {
    "nom": 1,
    "barruf": 2,
    "estat": 3,
    "club": 4,
    "victories_temporada": 5,
    "partides_temporada": 6,
    "victories_totals": 7,
    "partides_totals": 8,
    "debutant": 9,
    "darrera_temporada": 10,
    "posicio": 11,
}


# Mateixes regles que lib/importacio/noms.ts. Si en canvieu cap, canvieu-les als
# dos llocs i regenereu els àlies.
def neteja(nom: str) -> str:
    """Treu del nom el que no s'hi veu pero hi es.

    Les dades d'origen en porten: a la llista del BARRUF hi ha un jugador amb un
    WORD JOINER (U+2060) al davant del nom i uns quants amb espai al comencament.
    Si no es neteja, la coincidencia exacta hi falla sempre i la mateixa persona
    demana validacio manual a cada importacio.

    'Cf' son els caracters de format invisibles i 'Zs' els separadors que no son
    l'espai normal.
    """
    text = "".join(
        " " if unicodedata.category(c) == "Zs" else c
        for c in nom
        if unicodedata.category(c) != "Cf"
    )
    return re.sub(r"\s+", " ", text).strip()


def normalitza(nom: str) -> str:
    """Forma canònica per comparar noms: sense accents, ni punt volat, ni majúscules."""
    text = neteja(nom).replace("·", "").replace("’", "'").replace("‘", "'")
    descompost = unicodedata.normalize("NFD", text)
    return "".join(c for c in descompost if unicodedata.category(c) != "Mn").lower()


def temporada(valor) -> tuple[str | None, bool]:
    """Normalitza la darrera temporada. Retorna (codi, es_cohort_llegat)."""
    if valor is None:
        return None, False
    text = str(valor)
    if text.startswith("<="):
        return None, True
    # Hi ha onze files marcades 'Rec. 14-15'.
    coincidencia = re.search(r"(\d{2,4})-(\d{2})", text)
    if not coincidencia:
        return None, True
    any_inici = int(coincidencia.group(1))
    if any_inici < 100:
        any_inici += 2000
    return f"{any_inici}-{coincidencia.group(2)}", False


def cita(valor) -> str:
    if valor is None:
        return "NULL"
    return "'" + str(valor).replace("'", "''") + "'"


def llegeix(cami: str) -> list[dict]:
    full = openpyxl.load_workbook(cami, data_only=True)["DadesÚltimBarruf"]
    jugadors = []

    for fila in range(2, full.max_row + 1):
        nom = full.cell(fila, COLUMNES["nom"]).value
        if not nom:
            continue

        def valor(clau):
            return full.cell(fila, COLUMNES[clau]).value

        codi_temporada, cohort_llegat = temporada(valor("darrera_temporada"))

        jugadors.append(
            {
                "nom": neteja(str(nom)),
                "barruf": valor("barruf"),
                "estat": valor("estat"),
                "club": (neteja(str(valor("club"))) or None) if valor("club") else None,
                "victories_temporada": valor("victories_temporada") or 0,
                "partides_temporada": valor("partides_temporada") or 0,
                "victories_totals": valor("victories_totals") or 0,
                "partides_totals": valor("partides_totals") or 0,
                "debutant": valor("debutant") == "deb",
                "darrera_temporada": codi_temporada,
                "cohort_llegat": cohort_llegat,
                "posicio": valor("posicio"),
            }
        )

    return jugadors


def genera(jugadors: list[dict]) -> str:
    linies: list[str] = []
    escriu = linies.append

    noms_norm = {}
    for jugador in jugadors:
        clau = normalitza(jugador["nom"])
        if clau in noms_norm:
            raise SystemExit(
                f"Dos jugadors comparteixen forma normalitzada: "
                f"{noms_norm[clau]!r} i {jugador['nom']!r}"
            )
        noms_norm[clau] = jugador["nom"]

    escriu(f"""-- =============================================================================
-- Llavor del BARRUF — edició {EDICIO_LLAVOR}
-- =============================================================================
-- Generat per scripts/genera_llavor.py a partir de la pestanya
-- `DadesÚltimBarruf` del GENERADOR_BARRUF de l'AJUSC.
--
-- Aquest és el punt zero de la cadena. Els valors NO es deriven de cap partida:
-- són els publicats a l'edició {EDICIO_LLAVOR} i s'hereten tal qual. A partir
-- d'aquí, tot BARRUF es calcula rejugant els campionats que computen.
--
-- NO editeu aquest fitxer a mà: torneu a executar el generador.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Temporades
-- -----------------------------------------------------------------------------
INSERT INTO temporades (codi, any_inici, data_inici, data_fi) VALUES""")

    files = [
        f"    ('{any_}-{str(any_ + 1)[2:]}', {any_}, "
        f"DATE '{any_}-09-01', DATE '{any_ + 1}-08-31')"
        for any_ in range(PRIMERA_TEMPORADA, DARRERA_TEMPORADA + 1)
    ]
    escriu(",\n".join(files))
    escriu("ON CONFLICT (codi) DO NOTHING;\n")

    # ---------------------------------------------------------------- clubs
    clubs = sorted({j["club"] for j in jugadors if j["club"]})
    escriu("-- -----------------------------------------------------------------------------")
    escriu(f"-- Clubs i grups de joc ({len(clubs)})")
    escriu("-- -----------------------------------------------------------------------------")
    escriu("INSERT INTO clubs (nom) VALUES")
    escriu(",\n".join(f"    ({cita(club)})" for club in clubs))
    escriu("ON CONFLICT (nom) DO NOTHING;\n")

    # ------------------------------------------------------------- jugadors
    escriu("-- -----------------------------------------------------------------------------")
    escriu(f"-- Jugadors ({len(jugadors)})")
    escriu("--")
    escriu("-- El número públic s'assigna per ordre alfabètic del nom normalitzat, de")
    escriu("-- manera que el generador sigui reproduïble. Un cop assignat no es canvia")
    escriu("-- ni es reutilitza mai.")
    escriu("-- -----------------------------------------------------------------------------")

    ordenats = sorted(jugadors, key=lambda j: normalitza(j["nom"]))
    for numero, jugador in enumerate(ordenats, start=1):
        jugador["numero"] = numero

    escriu("INSERT INTO jugadors (numero, nom_complet, club_id) VALUES")
    files = []
    for jugador in ordenats:
        club = (
            f"(SELECT id FROM clubs WHERE nom = {cita(jugador['club'])})"
            if jugador["club"]
            else "NULL"
        )
        files.append(f"    ({jugador['numero']}, {cita(jugador['nom'])}, {club})")
    escriu(",\n".join(files))
    escriu("ON CONFLICT (numero) DO NOTHING;\n")

    escriu("-- La seqüència ha de continuar a partir de l'últim número assignat.")
    escriu(
        f"SELECT setval('numero_jugador_seq', {len(ordenats)}, TRUE);\n"
    )

    # ---------------------------------------------------------------- àlies
    escriu("-- -----------------------------------------------------------------------------")
    escriu("-- Àlies: el nom tal com surt a les llistes publicades.")
    escriu("-- Cada campionat que s'importi n'hi anirà afegint variants.")
    escriu("-- -----------------------------------------------------------------------------")
    escriu("INSERT INTO jugador_alies (jugador_id, alies, alies_norm, origen) VALUES")
    files = [
        f"    ((SELECT id FROM jugadors WHERE numero = {j['numero']}), "
        f"{cita(j['nom'])}, {cita(normalitza(j['nom']))}, 'llavor barruf {EDICIO_LLAVOR}')"
        for j in ordenats
    ]
    escriu(",\n".join(files))
    escriu("ON CONFLICT (alies_norm) DO NOTHING;\n")

    # -------------------------------------------------------------- edició
    escriu("-- -----------------------------------------------------------------------------")
    escriu("-- L'edició llavor")
    escriu("-- -----------------------------------------------------------------------------")
    escriu(
        "INSERT INTO barruf_edicions "
        "(numero, data_publicacio, temporada_codi, es_llavor, descripcio) VALUES"
    )
    escriu(
        f"    ({EDICIO_LLAVOR}, DATE '{date(2026, 8, 31)}', '{TEMPORADA_LLAVOR}', TRUE,"
    )
    escriu(
        "     'Punt de partida heretat del GENERADOR_BARRUF. Sense partides al darrere: "
        "no es pot recalcular.')"
    )
    escriu("ON CONFLICT (numero) DO NOTHING;\n")

    # --------------------------------------------------------------- valors
    escriu("-- -----------------------------------------------------------------------------")
    escriu(f"-- Valors de l'edició llavor ({len(jugadors)})")
    escriu("-- -----------------------------------------------------------------------------")
    escriu("""INSERT INTO barruf_valors (
    edicio_id, jugador_id, barruf,
    partides_totals, victories_totals,
    partides_temporada, victories_temporada,
    estat, darrera_temporada, cohort_llegat, debutant, posicio
) VALUES""")

    edicio = f"(SELECT id FROM barruf_edicions WHERE numero = {EDICIO_LLAVOR})"
    files = []
    for jugador in ordenats:
        files.append(
            f"    ({edicio}, (SELECT id FROM jugadors WHERE numero = {jugador['numero']}), "
            f"{jugador['barruf']}, "
            f"{int(jugador['partides_totals'])}, {jugador['victories_totals']}, "
            f"{int(jugador['partides_temporada'])}, {jugador['victories_temporada']}, "
            f"'{jugador['estat']}', {cita(jugador['darrera_temporada'])}, "
            f"{'TRUE' if jugador['cohort_llegat'] else 'FALSE'}, "
            f"{'TRUE' if jugador['debutant'] else 'FALSE'}, "
            f"{jugador['posicio'] if jugador['posicio'] is not None else 'NULL'})"
        )
    escriu(",\n".join(files))
    escriu("ON CONFLICT (edicio_id, jugador_id) DO NOTHING;\n")

    escriu("COMMIT;")

    return "\n".join(linies) + "\n"


def genera_json(jugadors: list[dict]) -> str:
    """Els mateixos jugadors en JSON, per fer-los servir de fixture a les proves.

    Surt del mateix lloc que la migració perquè no puguin divergir.
    """
    ordenats = sorted(jugadors, key=lambda j: normalitza(j["nom"]))
    return json.dumps(
        {
            "edicio": EDICIO_LLAVOR,
            "temporada": TEMPORADA_LLAVOR,
            "origen": "GENERADOR_BARRUF, pestanya DadesUltimBarruf",
            "jugadors": [
                {
                    "numero": numero,
                    "nomComplet": j["nom"],
                    "barruf": j["barruf"],
                    "partidesTotals": int(j["partides_totals"]),
                    "victoriesTotals": j["victories_totals"],
                    "estat": j["estat"],
                    "darreraTemporada": j["darrera_temporada"],
                    "cohortLlegat": j["cohort_llegat"],
                }
                for numero, j in enumerate(ordenats, start=1)
            ],
        },
        ensure_ascii=False,
        indent=1,
    ) + "\n"


def main() -> None:
    arguments = sys.argv[1:]
    com_a_json = "--json" in arguments
    camins = [a for a in arguments if not a.startswith("--")]
    if len(camins) != 1:
        raise SystemExit(__doc__)

    jugadors = llegeix(camins[0])
    sys.stdout.write(genera_json(jugadors) if com_a_json else genera(jugadors))


if __name__ == "__main__":
    main()
