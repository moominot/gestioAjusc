"""
Correcció de l'arxiu (edicions 142-189) a partir dels BARRUF publicats en PDF i
del full «Totes Temporades» del Club Scrabble Manacor.

Què corregeix:

  · L'estat de les edicions que no quadra amb el PDF publicat. En unes quantes
    el full de càlcul no s'havia recalculat i el seu «estat nou» era l'anterior;
    el generador de l'arxiu el va prendre per bo i l'error s'arrossegava. Ara
    l'estat d'aquestes edicions és el del PDF, amb els decimals del nostre quan
    el valor arrodonit coincideix.
  · Les partides dels campionats que l'arxiu tenia buits o gairebé, quan el
    full de Manacor les té i quadren amb el que es va publicar (partides i
    victòries de cada jugador).
  · Els inscrits dels campionats que no tenen partides: surten al PDF.
  · Les variacions per campionat: abans i després, les oficials; esperança i
    K, calculades com fa el motor. Per a qui no té partides desades,
    l'esperança es dedueix de la variació publicada.

Ús: python corregeix_arxiu.py <bd.json> <estat.json> <carpeta pdf-json> <totes.xlsx> <sortida.sql>
     python corregeix_arxiu.py ... --valida     (compara el motor amb les variacions desades)
"""

import glob
import json
import math
import sys
from collections import defaultdict

import openpyxl

from extreu_estadistiques import llegeix_full, normalitza

SIGMA = 283.84
BARRUF_INICIAL = 950
LLINDAR_K = 50

# Campionats de l'arxiu que es refan amb les partides del full: edició → pestanya.
DEL_FULL = {
    156: "ManaCup 22-23",
    161: "10è Campionat Scrabble Català S",
    162: "2n Escarxofa del Prat",
    168: "12è Campionat de Scrabble de Ba",
    169: "VIII Ciutat de Manacor 2024",
    170: "Xàmpions 2024",
    174: "Lliga CS Delta Prat 2023 2024",
    178: "9è Campionat de Canet",
}
PRIMERA, DARRERA = 142, 189
# Edicions amb el PDF mal llegit (la 182 només en treu una pàgina).
PDF_TRENCAT = {182}

# Àlies mal assignat per l'arxiu: «Javier Larrañaga» és el Xabier Larrañaga (62),
# no el Jaume Vives (384). A l'edició 149 (9è de Sabadell) les seves partides
# havien anat a parar al 384.
ALIES_CORREGITS = {"javier larranaga": 62}
REASSIGNACIONS = [(149, 384, 62)]  # (edició, número dolent, número bo)


def phi(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def arrodoneix(v):
    return int(math.copysign(math.floor(abs(v) + 0.5), v)) if v else 0


def main(fitxer_bd, fitxer_estat, carpeta_pdf, fitxer_full, sortida, valida=False):
    bd = json.load(open(fitxer_bd, encoding="utf-8"))
    per_nom = {}
    for f in bd["noms"]:
        per_nom.setdefault(f["a"], f["n"])
    for f in bd["fusions"] or []:
        per_nom.setdefault(f["a"], f["cap"])
    per_nom.update(ALIES_CORREGITS)

    estat = json.load(open(fitxer_estat, encoding="utf-8"))
    temporada = {int(k): v for k, v in estat["temporades"].items()}
    nostre = defaultdict(dict)
    for v in estat["valors"]:
        nostre[v["ed"]][v["n"]] = v

    pdf = {}
    for cami in glob.glob(f"{carpeta_pdf}/pdf-*.json"):
        d = json.load(open(cami, encoding="utf-8"))
        if d["edicio"] in PDF_TRENCAT:
            continue
        files = {}
        for f in d["files"]:
            n = per_nom.get(normalitza(f["nom"]))
            if n is not None:
                files[n] = f
        pdf[d["edicio"]] = files

    # ------------------------------------------------------------------
    # 1. Estat de cada edició: el nostre si quadra amb el PDF, si no el PDF.
    # ------------------------------------------------------------------
    def quadra(a, p):
        return a["pt"] == p["pt"] and float(a["vt"]) == float(p["vt"]) and abs(float(a["b"]) - p["barruf"]) <= 1

    corregides = {}
    for ed in range(PRIMERA, DARRERA + 1):
        if ed not in pdf:
            continue
        p = pdf[ed]
        dolents = [n for n in p if n not in nostre[ed] or not quadra(nostre[ed][n], p[n])]
        if not dolents:
            continue
        files = {}
        for n, f in p.items():
            # Els decimals, d'una fila nostra (d'aquesta edició o de les veïnes)
            # que arrodonida doni el mateix.
            barruf = float(f["barruf"])
            referencia = None
            for altra in (ed, ed + 1, ed - 1, ed + 2):
                r = nostre.get(altra, {}).get(n)
                if r and quadra(r, f):
                    barruf, referencia = float(r["b"]), r
                    break
            if referencia is None:
                referencia = nostre[ed].get(n) or nostre.get(ed + 1, {}).get(n) or {}
            darrera = temporada[ed] if f["ptemp"] > 0 else referencia.get("darrera")
            if f["pt"] == 0:
                darrera = None
            files[n] = {
                "b": barruf, "pt": f["pt"], "vt": f["vt"], "ptemp": f["ptemp"], "vtemp": f["vtemp"],
                "estat": f["estat"], "pos": f["posicio"], "deb": bool(f["deb"]),
                "darrera": darrera,
                "cohort": bool(referencia.get("cohort")) and darrera is None,
            }
        corregides[ed] = files
        print(f"estat {ed}: {len(dolents)} de {len(p)} no quadraven", file=sys.stderr)

    def estat_de(ed):
        if ed in corregides:
            return corregides[ed]
        return nostre[ed]

    def b_de(ed, n):
        f = estat_de(ed).get(n)
        return float(f["b"]) if f else None

    # ------------------------------------------------------------------
    # 2. Partides de cada campionat: les nostres, o les del full.
    # ------------------------------------------------------------------
    partides = defaultdict(list)
    for p in bd["partides"]:
        if p["ed"] is not None:
            partides[p["ed"]].append({"r": p["r"], "n1": p["n1"], "n2": p["n2"],
                                      "res": None if p["res"] is None else float(p["res"])})
    for ed, dolent, bo in REASSIGNACIONS:
        for p in partides[ed]:
            for k in ("n1", "n2"):
                if p[k] == dolent:
                    p[k] = bo

    wb = openpyxl.load_workbook(fitxer_full, data_only=True, read_only=True)
    pestanyes = {t: ps for t, ps in llegeix_full(wb) if t in DEL_FULL.values()}
    noves = {}
    for ed, titol in DEL_FULL.items():
        llista = []
        for p in pestanyes[titol]:
            n1, n2 = per_nom.get(normalitza(p["j1"])), per_nom.get(normalitza(p["j2"]))
            if not n1 or not n2 or n1 == n2:
                continue
            res = None
            if p["p1"] is not None and p["p2"] is not None:
                res = 1.0 if p["p1"] > p["p2"] else 0.0 if p["p1"] < p["p2"] else 0.5
            llista.append({**p, "r": p["ronda"] or 1, "n1": n1, "n2": n2, "res": res})
        # Un jugador no pot tenir dues partides a la mateixa ronda. Les que al full
        # en repeteixen van a rondes noves, després de la darrera.
        ocupats = defaultdict(set)
        xoquen = []
        for p in llista:
            if p["n1"] in ocupats[p["r"]] or p["n2"] in ocupats[p["r"]]:
                xoquen.append(p)
            else:
                ocupats[p["r"]].update((p["n1"], p["n2"]))
        seguent = max(ocupats, default=0) + 1
        for p in xoquen:
            r = seguent
            while p["n1"] in ocupats[r] or p["n2"] in ocupats[r]:
                r += 1
            p["r"] = r
            ocupats[r].update((p["n1"], p["n2"]))
        if xoquen:
            print(f"edició {ed}: {len(xoquen)} partides mogudes a rondes noves", file=sys.stderr)
        noves[ed] = llista
        partides[ed] = llista

    # ------------------------------------------------------------------
    # 3. Variacions, amb les victòries i partides publicades.
    # ------------------------------------------------------------------
    def publicat(ed):
        """Partides i victòries de cada jugador a l'edició, segons els PDF."""
        if ed not in pdf or ed - 1 not in pdf:
            return None
        out = {}
        for n, f in pdf[ed].items():
            a = pdf[ed - 1].get(n)
            dp = f["pt"] - (a["pt"] if a else 0)
            if dp:
                out[n] = (dp, float(f["vt"]) - (float(a["vt"]) if a else 0.0))
        return out

    # Els campionats que cal refer: els de les edicions amb l'estat corregit, els
    # de la següent (l'estat d'abans canvia), els refets del full i els de les
    # partides reassignades.
    afectades = set(corregides) | {ed + 1 for ed in corregides} | set(DEL_FULL) | {ed for ed, _, _ in REASSIGNACIONS}
    variacions = {}
    inscrits = {}
    for ed in sorted(afectades):
        pub = publicat(ed)
        abans, despres = estat_de(ed - 1), estat_de(ed)
        per_jugador = defaultdict(list)
        for p in partides.get(ed, []):
            per_jugador[p["n1"]].append((p["n2"], p["res"]))
            per_jugador[p["n2"]].append((p["n1"], None if p["res"] is None else 1 - p["res"]))
        jugadors = set(per_jugador) | set(pub or {})
        files = []
        for n in sorted(jugadors):
            # El full calcula amb el BARRUF anterior arrodonit a l'enter.
            b0 = b_de(ed - 1, n)
            barruf_abans = arrodoneix(b0) if b0 else BARRUF_INICIAL
            prev = abans.get(n, {}).get("pt", 0) or 0
            jugades = per_jugador.get(n, [])
            g, v = (pub or {}).get(n, (len(jugades), sum(r or 0 for _, r in jugades)))
            k = 20 if prev + g > LLINDAR_K else 30
            d = despres.get(n)
            barruf_despres = float(d["b"]) if d else None
            if jugades and len(jugades) == g:
                esperanca = sum(phi((barruf_abans - arrodoneix(b_de(ed - 1, o) or BARRUF_INICIAL)) / SIGMA) for o, _ in jugades)
            elif barruf_despres is not None:
                # Sense les partides: l'esperança que dona la variació publicada.
                esperanca = v - (barruf_despres - barruf_abans) / k
            else:
                continue
            if barruf_despres is None:
                barruf_despres = barruf_abans + arrodoneix((v - esperanca) * k)
            files.append({"n": n, "abans": barruf_abans, "p": g, "v": v, "e": esperanca, "k": k, "despres": barruf_despres})
        variacions[ed] = files
        inscrits[ed] = {f["n"]: f["v"] for f in files}

    if valida:
        desades = defaultdict(dict)
        for v in estat["variacions"]:
            desades[v["ed"]][v["n"]] = v
        for ed in sorted(afectades):
            ok = de = 0
            for f in variacions.get(ed, []):
                d = desades[ed].get(f["n"])
                if not d:
                    continue
                de += 1
                if abs(float(d["e"]) - f["e"]) < 1e-4 and d["k"] == f["k"] and abs(float(d["abans"]) - f["abans"]) < 1e-6:
                    ok += 1
            print(f"variacions {ed}: {ok}/{de} iguals a les desades, {len(variacions.get(ed, []))} en total")
        return

    # ------------------------------------------------------------------
    # 4. SQL
    # ------------------------------------------------------------------
    q = lambda x: "NULL" if x is None else "'" + str(x).replace("'", "''") + "'"
    num = lambda x: "NULL" if x is None else repr(round(float(x), 6))
    ent = lambda x: "NULL" if x is None else str(int(x))
    l = []
    w = l.append
    w("""-- =============================================================================
-- Correcció de l'arxiu: estats, partides i variacions de les edicions 142-189
-- =============================================================================
-- Generat per scripts/corregeix_arxiu.py. No s'edita a mà: es torna a generar.
--
-- Contrastat amb els BARRUF publicats en PDF, en unes quantes edicions l'arxiu
-- tenia l'estat de l'edició anterior (el full no s'havia recalculat), i alguns
-- campionats no tenien quasi cap partida. Els estats passen a ser els
-- publicats, i les partides que faltaven surten del full «Totes Temporades»
-- del Club Scrabble Manacor, on quadren amb les partides i victòries
-- publicades de cada jugador.
-- =============================================================================

BEGIN;
""")
    # Estats
    for ed, files in sorted(corregides.items()):
        w(f"-- Estat de l'edició {ed}: el del PDF publicat")
        w(f"DELETE FROM barruf_valors WHERE edicio_id = (SELECT id FROM barruf_edicions WHERE numero = {ed});")
        w("INSERT INTO barruf_valors (edicio_id, jugador_id, barruf, partides_totals, victories_totals, partides_temporada, "
          "victories_temporada, estat, darrera_temporada, cohort_llegat, debutant, posicio)")
        w(f"SELECT (SELECT id FROM barruf_edicions WHERE numero = {ed}), j.id, v.b::numeric, v.pt::integer, v.vt::numeric, "
          "v.ptemp::integer, v.vtemp::numeric, v.estat::estat_jugador, v.darrera::text, v.cohort::boolean, v.deb::boolean, v.pos::integer")
        w("FROM (VALUES")
        w(",\n".join(
            f"    ({n}, {num(f['b'])}, {f['pt']}, {num(f['vt'])}, {f['ptemp']}, {num(f['vtemp'])}, {q(f['estat'])}, "
            f"{q(f['darrera'])}, {str(f['cohort']).lower()}, {str(f['deb']).lower()}, {ent(f['pos'])})"
            for n, f in sorted(files.items())))
        w(") AS v(n, b, pt, vt, ptemp, vtemp, estat, darrera, cohort, deb, pos)")
        w("JOIN jugadors j ON j.numero = v.n;\n")

    # Àlies i partides mal assignats
    for alies, numero in ALIES_CORREGITS.items():
        w(f"UPDATE jugador_alies SET jugador_id = (SELECT id FROM jugadors WHERE numero = {numero}) WHERE alies_norm = {q(alies)};")
    for ed, dolent, bo in REASSIGNACIONS:
        camp = f"(SELECT id FROM campionats WHERE primera_edicio = {ed})"
        for costat in (1, 2):
            w(f"UPDATE partides SET jugador_{costat}_id = (SELECT id FROM jugadors WHERE numero = {bo}) "
              f"WHERE campionat_id = {camp} AND jugador_{costat}_id = (SELECT id FROM jugadors WHERE numero = {dolent});")
    w("")

    # Partides del full
    for ed, llista in sorted(noves.items()):
        w(f"-- Partides de l'edició {ed}, del full «{DEL_FULL[ed]}»")
        w(f"DELETE FROM partides WHERE campionat_id = (SELECT id FROM campionats WHERE primera_edicio = {ed});")
        w("INSERT INTO partides (campionat_id, ronda, jugador_1_id, jugador_2_id, resultat_1, punts_1, punts_2, scrabbles_1, scrabbles_2,")
        w("    mot_1, punts_mot_1, mot_lletra_1, punts_lletra_1, mot_2, punts_mot_2, mot_lletra_2, punts_lletra_2)")
        w(f"SELECT (SELECT id FROM campionats WHERE primera_edicio = {ed}), p.r::integer, j1.id, j2.id, p.res::numeric, "
          "p.p1::integer, p.p2::integer, p.s1::integer, p.s2::integer, p.m1::text, p.pm1::integer, p.l1::text, p.pl1::integer, "
          "p.m2::text, p.pm2::integer, p.l2::text, p.pl2::integer")
        w("FROM (VALUES")
        w(",\n".join(
            f"    ({p['r']}, {p['n1']}, {p['n2']}, {num(p['res'])}, {ent(p['p1'])}, {ent(p['p2'])}, {ent(p['s1'])}, {ent(p['s2'])}, "
            f"{q(p['m1'])}, {ent(p['pm1'])}, {q(p['l1'])}, {ent(p['pl1'])}, {q(p['m2'])}, {ent(p['pm2'])}, {q(p['l2'])}, {ent(p['pl2'])})"
            for p in llista))
        w(") AS p(r, n1, n2, res, p1, p2, s1, s2, m1, pm1, l1, pl1, m2, pm2, l2, pl2)")
        w("JOIN jugadors j1 ON j1.numero = p.n1 JOIN jugadors j2 ON j2.numero = p.n2;\n")

    # Inscrits i variacions de tots els campionats del tram
    w("-- Inscrits (amb les victòries publicades) i variacions de cada campionat del tram")
    for ed in sorted(afectades):
        files = variacions.get(ed)
        if not files:
            continue
        camp = f"(SELECT id FROM campionats WHERE primera_edicio = {ed})"
        valors_ins = ", ".join(f"({f['n']}, {num(f['v'])})" for f in files)
        w(f"DELETE FROM inscripcions WHERE campionat_id = {camp};")
        w(f"INSERT INTO inscripcions (campionat_id, jugador_id, victories) SELECT {camp}, j.id, i.v::numeric "
          f"FROM (VALUES {valors_ins}) AS i(n, v) JOIN jugadors j ON j.numero = i.n;")
        w(f"DELETE FROM barruf_variacions WHERE campionat_id = {camp};")
        w("INSERT INTO barruf_variacions (campionat_id, jugador_id, barruf_abans, partides, victories, esperanca, factor_k, variacio, barruf_despres)")
        w(f"SELECT {camp}, j.id, v.a::numeric, v.p::integer, v.v::numeric, v.e::numeric, v.k::integer, v.d::numeric - v.a::numeric, v.d::numeric FROM (VALUES")
        w(",\n".join(f"    ({f['n']}, {num(f['abans'])}, {f['p']}, {num(f['v'])}, {f['e']:.6f}, {f['k']}, {num(f['despres'])})" for f in files))
        w(") AS v(n, a, p, v, e, k, d) JOIN jugadors j ON j.numero = v.n;\n")

    w("COMMIT;")
    open(sortida, "w", encoding="utf-8", newline="\n").write("\n".join(l) + "\n")
    print(f"{len(corregides)} estats corregits, {len(noves)} campionats refets", file=sys.stderr)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    main(*args, valida="--valida" in sys.argv)
