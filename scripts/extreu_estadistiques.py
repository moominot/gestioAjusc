"""
Estadístiques de partida del full «Totes Temporades» → JSON per a la migració.

El full té una pestanya per campionat, una fila per partida, amb scrabbles,
millor jugada i millor jugada amb lletra especial de cada jugador. Els noms ja hi
són normalitzats (la pestanya «Jugadors» en fa la correspondència).

Els noms de les pestanyes no coincideixen amb els dels nostres campionats, i
alguns campionats del full són més d'un dels nostres (fases, blocs de rondes).
Per això no es casa per nom sinó per partides: cada partida del full es busca
entre les nostres per la parella de jugadors, dins els campionats que en
comparteixen prou, i es desempata per puntuació i ronda.

Ús: python extreu_estadistiques.py totes.xlsx bd.json sortida.json
on bd.json és l'exportació de partides i noms de la base de dades.
"""

import json
import re
import sys
import unicodedata
import warnings
from collections import Counter, defaultdict

import openpyxl

warnings.filterwarnings("ignore")

PESTANYES_NO_PARTIDES = {"JugadorsFiltrat", "Campionats", "Jugadors", "NomsBarruf"}


def normalitza(nom):
    """El mateix que normalitza_nom() de la base de dades."""
    text = re.sub("[­​-‏⁠-⁤﻿]", "", str(nom))
    text = re.sub("[  -   　]", " ", text)
    text = text.replace("·", "").replace("‘", "'").replace("’", "'")
    text = "".join(c for c in unicodedata.normalize("NFD", text) if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", text).strip().lower()


def capcalera(text):
    return re.sub(r"[\s_]+", " ", str(text or "")).strip().lower()


# Columna del full → camp. La primera variant que hi sigui, mana.
CAMPS = {
    "ronda": ["ronda"],
    "j1": ["jugador1"],
    "j2": ["jugador2"],
    "p1": ["puntuacio 1"],
    "p2": ["puntuacio 2"],
    "s1": ["scrabbles 1"],
    "s2": ["scrabbles 2"],
    "m1": ["mot 1"],
    "m2": ["mot 2"],
    "pm1": ["puntsmot 1"],
    "pm2": ["puntsmot 2"],
    "l1": ["lletra 1"],
    "l2": ["lletra 2"],
    "pl1": ["punts lletra 1"],
    "pl2": ["punts lletra 2"],
}


def enter(v):
    if v is None or v == "":
        return None
    try:
        f = float(str(v).replace(",", "."))
    except ValueError:
        return None
    return int(round(f)) if f == f else None


def mot(v):
    """Mot en majúscules i amb la ela geminada ben escrita."""
    if v is None:
        return None
    text = re.sub(r"\s+", " ", str(v)).strip()
    if not text or text in ("-", "0"):
        return None
    text = re.sub(r"l[.\-·•∙ŀ]l", "l·l", text, flags=re.I).replace("ŀl", "l·l").replace("Ŀl", "l·l")
    return text.upper()


def llegeix_full(wb):
    for ws in wb.worksheets:
        if ws.title in PESTANYES_NO_PARTIDES:
            continue
        files = list(ws.iter_rows(values_only=True))
        if not files:
            continue
        cap = [capcalera(c) for c in files[0]]
        col = {}
        for camp, variants in CAMPS.items():
            for v in variants:
                if v in cap:
                    col[camp] = cap.index(v)
                    break
        partides = []
        for num, fila in enumerate(files[1:], start=2):
            val = lambda k: fila[col[k]] if k in col and col[k] < len(fila) else None
            if not val("j1") or not val("j2"):
                continue
            partides.append({
                "fila": num,
                "ronda": enter(val("ronda")),
                "j1": str(val("j1")).strip(), "j2": str(val("j2")).strip(),
                "p1": enter(val("p1")), "p2": enter(val("p2")),
                "s1": enter(val("s1")), "s2": enter(val("s2")),
                "m1": mot(val("m1")), "m2": mot(val("m2")),
                "pm1": enter(val("pm1")), "pm2": enter(val("pm2")),
                "l1": mot(val("l1")), "l2": mot(val("l2")),
                "pl1": enter(val("pl1")), "pl2": enter(val("pl2")),
            })
        yield ws.title, partides


def te_estadistiques(p):
    return any(p[k] is not None for k in ("s1", "s2", "m1", "m2", "pm1", "pm2", "l1", "l2", "pl1", "pl2"))


def gira(p):
    """La mateixa partida amb els jugadors intercanviats."""
    q = dict(p)
    for a, b in (("j1", "j2"), ("p1", "p2"), ("s1", "s2"), ("m1", "m2"), ("pm1", "pm2"), ("l1", "l2"), ("pl1", "pl2"), ("n1", "n2")):
        q[a], q[b] = p.get(b), p.get(a)
    return q


def main(fitxer_full, fitxer_bd, sortida):
    bd = json.load(open(fitxer_bd, encoding="utf-8"))
    per_nom = {}
    for f in bd["noms"]:
        per_nom.setdefault(f["a"], f["n"])
    for f in bd["fusions"] or []:
        per_nom.setdefault(f["a"], f["cap"])

    # Partides nostres per parella de jugadors.
    per_parella = defaultdict(list)
    per_edicio = Counter()
    for i, p in enumerate(bd["partides"]):
        p["i"] = i
        per_parella[frozenset((p["n1"], p["n2"]))].append(p)
        per_edicio[p["ed"]] += 1

    wb = openpyxl.load_workbook(fitxer_full, data_only=True, read_only=True)
    usades = set()
    actualitzacions = []
    informe = []
    desconeguts = Counter()

    for titol, partides in llegeix_full(wb):
        amb = [p for p in partides if te_estadistiques(p) or p["p1"] is not None]
        for p in amb:
            p["n1"] = per_nom.get(normalitza(p["j1"]))
            p["n2"] = per_nom.get(normalitza(p["j2"]))
            for k in ("j1", "j2"):
                if p["n" + k[1]] is None:
                    desconeguts[p[k]] += 1
        resolubles = [p for p in amb if p["n1"] and p["n2"] and p["n1"] != p["n2"]]

        # Les mateixes parelles es tornen a trobar temporada rere temporada, i
        # casar-les soltes barrejaria anys. Es casa ronda a ronda: una ronda del
        # full correspon a la ronda nostra que en comparteix la majoria de
        # parelles. Les coincidències casuals no omplen mai mitja ronda.
        per_ronda = defaultdict(list)
        for p in resolubles:
            per_ronda[p["ronda"]].append(p)
        destins = {}  # ronda del full -> (edició, ronda nostra)
        for ronda, llista in per_ronda.items():
            vots = Counter()
            for p in llista:
                for q in per_parella.get(frozenset((p["n1"], p["n2"])), []):
                    if q["i"] not in usades:
                        vots[(q["ed"], q["r"])] += 1
            if vots:
                (desti, n), = vots.most_common(1)
                if n >= max(2, 0.5 * len(llista)):
                    destins[ronda] = desti
        edicions = {ed for ed, _ in destins.values()}

        # Si les nostres rondes es van deduir, no coincideixen amb les del full.
        # Llavors, dins els campionats ja casats, una parella que només hi surt
        # un cop és la mateixa partida.
        def candidates(p, desti):
            parella = per_parella.get(frozenset((p["n1"], p["n2"])), [])
            if desti is not None:
                exactes = [q for q in parella if q["i"] not in usades and (q["ed"], q["r"]) == desti]
                if exactes:
                    return exactes
            lliures = [q for q in parella if q["i"] not in usades and q["ed"] in edicions]
            return lliures if len(lliures) == 1 else []

        casades = 0
        punts_diferents = 0
        for p in sorted(resolubles, key=lambda p: p["ronda"] not in destins):
            desti = destins.get(p["ronda"])
            millor, puntuacio = None, -1
            for q in candidates(p, desti):
                o = p if q["n1"] == p["n1"] else gira(p)
                s = 0
                if q["p1"] is not None and o["p1"] is not None:
                    s += 4 if (q["p1"], q["p2"]) == (o["p1"], o["p2"]) else -4
                if p["ronda"] is not None and q["r"] == p["ronda"]:
                    s += 1
                if s > puntuacio:
                    millor, puntuacio = q, s
            if millor is None:
                continue
            usades.add(millor["i"])
            casades += 1
            o = p if millor["n1"] == p["n1"] else gira(p)
            if millor["p1"] is not None and o["p1"] is not None and (millor["p1"], millor["p2"]) != (o["p1"], o["p2"]):
                punts_diferents += 1
            actualitzacions.append({
                "ed": millor["ed"], "r": millor["r"], "n1": millor["n1"], "n2": millor["n2"],
                # Puntuació del full, només per a les partides que no en tenen.
                "p1": o["p1"] if millor["p1"] is None else None,
                "p2": o["p2"] if millor["p1"] is None else None,
                "res_bd": millor["res"],
                "s1": o["s1"], "s2": o["s2"],
                "m1": o["m1"], "pm1": o["pm1"], "m2": o["m2"], "pm2": o["pm2"],
                "l1": o["l1"], "pl1": o["pl1"], "l2": o["l2"], "pl2": o["pl2"],
                "pestanya": titol,
            })
        informe.append({
            "pestanya": titol, "files": len(partides), "amb_dades": len(amb),
            "resolubles": len(resolubles), "casades": casades,
            "edicions": sorted(edicions), "punts_diferents": punts_diferents,
        })

    json.dump({"actualitzacions": actualitzacions, "informe": informe,
               "desconeguts": desconeguts.most_common()},
              open(sortida, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for f in informe:
        print(f"{f['pestanya'][:32]:32} files={f['files']:4} dades={f['amb_dades']:4} "
              f"casades={f['casades']:4} ed={f['edicions']} punts≠={f['punts_diferents']}")
    print("Noms desconeguts:", desconeguts.most_common(40))



def sql_text(v):
    return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"


def sql_enter(v):
    return "NULL" if v is None else str(int(v))


def escriu_sql(actualitzacions, fitxer):
    """La migració: una sola UPDATE amb totes les partides casades."""
    camps = ["s1", "s2", "m1", "pm1", "l1", "pl1", "m2", "pm2", "l2", "pl2", "p1", "p2"]
    utils = [a for a in actualitzacions if any(a[k] is not None for k in camps)]
    utils.sort(key=lambda a: (a["ed"], a["r"], a["n1"], a["n2"]))
    files = []
    for a in utils:
        valors = [sql_enter(a["ed"]), sql_enter(a["r"]), sql_enter(a["n1"]), sql_enter(a["n2"]),
                  sql_enter(a["p1"]), sql_enter(a["p2"]), sql_enter(a["s1"]), sql_enter(a["s2"]),
                  sql_text(a["m1"]), sql_enter(a["pm1"]), sql_text(a["l1"]), sql_enter(a["pl1"]),
                  sql_text(a["m2"]), sql_enter(a["pm2"]), sql_text(a["l2"]), sql_enter(a["pl2"])]
        files.append("(" + ", ".join(valors) + ")")
    with open(fitxer, "w", encoding="utf-8", newline="\n") as f:
        f.write(CAPCALERA_SQL.replace("{n}", str(len(files))))
        f.write(",\n".join(files))
        f.write(PEU_SQL.replace("{n}", str(len(files))))
    return len(files)


CAPCALERA_SQL = """-- =============================================================================
-- Estadístiques de partida dels campionats antics
-- =============================================================================
-- Generat per scripts/extreu_estadistiques.py a partir del full «Totes
-- Temporades» del Club Scrabble Manacor. No s'edita a mà: es torna a generar.
--
-- {n} partides amb scrabbles, millor jugada i millor jugada amb lletra especial
-- de cada jugador. Les partides es troben pel campionat (la seva edició del
-- BARRUF), la ronda i els números dels dos jugadors. La puntuació del full
-- només s'hi posa on no n'hi havia, i el resultat, on no se sabia i quadra
-- amb les victòries que es van publicar.
-- =============================================================================

DO $$
DECLARE
    v_casades INTEGER;
    v_desfetes INTEGER;
BEGIN
    -- Per poder desfer els resultats deduïts si no quadren amb l'arxiu.
    CREATE TEMP TABLE sense_resultat ON COMMIT DROP AS
        SELECT id, campionat_id FROM partides WHERE resultat_1 IS NULL;

    WITH v (ed, r, n1, n2, p1, p2, s1, s2, m1, pm1, l1, pl1, m2, pm2, l2, pl2) AS (VALUES
"""

PEU_SQL = """
    ),
    tipus AS (
        SELECT ed::integer AS ed, r::integer AS r, n1::integer AS n1, n2::integer AS n2,
               p1::integer AS p1, p2::integer AS p2, s1::integer AS s1, s2::integer AS s2,
               m1::text AS m1, pm1::integer AS pm1, l1::text AS l1, pl1::integer AS pl1,
               m2::text AS m2, pm2::integer AS pm2, l2::text AS l2, pl2::integer AS pl2
        FROM v
    ),
    fets AS (
        UPDATE partides p SET
            punts_1 = COALESCE(p.punts_1, t.p1),
            punts_2 = COALESCE(p.punts_2, t.p2),
            resultat_1 = COALESCE(p.resultat_1, CASE
                WHEN t.p1 IS NULL OR t.p2 IS NULL THEN NULL
                WHEN t.p1 > t.p2 THEN 1 WHEN t.p1 < t.p2 THEN 0 ELSE 0.5 END),
            scrabbles_1 = t.s1, scrabbles_2 = t.s2,
            mot_1 = t.m1, punts_mot_1 = t.pm1, mot_lletra_1 = t.l1, punts_lletra_1 = t.pl1,
            mot_2 = t.m2, punts_mot_2 = t.pm2, mot_lletra_2 = t.l2, punts_lletra_2 = t.pl2
        FROM tipus t
        JOIN campionats c ON c.primera_edicio = t.ed
        JOIN jugadors j1 ON j1.numero = t.n1
        JOIN jugadors j2 ON j2.numero = t.n2
        WHERE p.campionat_id = c.id AND p.ronda = t.r
          AND p.jugador_1_id = j1.id AND p.jugador_2_id = j2.id
        RETURNING 1
    )
    SELECT count(*) INTO v_casades FROM fets;

    IF v_casades <> {n} THEN
        RAISE EXCEPTION 'S''esperaven {n} partides i se n''han trobat %', v_casades;
    END IF;

    -- Un resultat deduït de la puntuació del full només es queda si, amb ell,
    -- les victòries de cada jugador del campionat continuen sent les que es
    -- van publicar. Si en algun no quadra, el full i l'arxiu discrepen i el
    -- campionat es queda amb els resultats desconeguts, com abans.
    WITH costats AS (
        SELECT campionat_id, jugador_1_id AS jugador_id, resultat_1 AS r
        FROM partides WHERE jugador_2_id IS NOT NULL
        UNION ALL
        SELECT campionat_id, jugador_2_id, 1 - resultat_1
        FROM partides WHERE jugador_2_id IS NOT NULL
    ),
    balanc AS (
        SELECT campionat_id, jugador_id, sum(r) AS victories, bool_and(r IS NOT NULL) AS complet
        FROM costats GROUP BY 1, 2
    ),
    discrepants AS (
        SELECT DISTINCT i.campionat_id
        FROM inscripcions i
        JOIN balanc b ON b.campionat_id = i.campionat_id AND b.jugador_id = i.jugador_id
        WHERE i.victories IS NOT NULL AND b.complet AND b.victories <> i.victories
    )
    UPDATE partides p SET resultat_1 = NULL
    FROM sense_resultat s
    WHERE p.id = s.id AND p.resultat_1 IS NOT NULL
      AND s.campionat_id IN (SELECT campionat_id FROM discrepants);
    GET DIAGNOSTICS v_desfetes = ROW_COUNT;
    RAISE NOTICE 'Resultats deduïts desfets per discrepància amb l''arxiu: %', v_desfetes;
END;
$$;
"""


if __name__ == "__main__":
    main(*sys.argv[1:4])
    if len(sys.argv) > 4:
        dades = json.load(open(sys.argv[3], encoding="utf-8"))
        print("Files SQL:", escriu_sql(dades["actualitzacions"], sys.argv[4]))
