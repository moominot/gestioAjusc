#!/usr/bin/env python3
"""
Llegeix un BARRUF publicat en PDF (el text que en treu `pdftotext -layout`).

Serveix per a les edicions de les quals el full ha arribat trencat: el PDF és
el que es va publicar i porta, per a cada jugador, el BARRUF, les victòries i
partides totals i de la temporada, i la posició o l'estat.

Els noms es reconeixen contra la llista de jugadors dels JSON de l'arxiu,
perquè al text el club i el nom queden enganxats («Manacor Xisco Truyols»).

Ús:
    python3 scripts/llegeix_pdf_barruf.py <carpeta dels JSON> <fitxer.txt>...
Escriu un `pdf-<edició>.json` a la carpeta dels JSON per cada PDF.
"""

from __future__ import annotations

import glob
import json
import re
import sys
import unicodedata
from pathlib import Path

FILA = re.compile(
    r"^\s*(\d+|inact|exp)\s+(.*?)\s+(\d{3,4})\s+([+-]?\d+)\s+([+-]?\d+(?:,\d)?)\s+([+-]?\d+)\s+"
    r"(\d+)%\s+(\d+,\d)\s+(\d+)\s+(\d+)%\s+(\d+,\d)\s+(\d+,\d)\s+(\d+)\s*$"
)


def normalitza(nom: str) -> str:
    text = unicodedata.normalize("NFD", nom.replace("·", "").replace("’", "'"))
    return re.sub(r"\s+", " ", "".join(c for c in text if unicodedata.category(c) != "Mn")).strip().lower()


def num(text: str) -> float:
    return float(text.replace(",", ".").replace("+", ""))


def main():
    carpeta = Path(sys.argv[1])
    noms = {}
    for f in glob.glob(str(carpeta / "*.json")):
        d = json.loads(Path(f).read_text())
        for llista in ("anterior", "nova"):
            for r in d.get(llista) or []:
                if r.get("nom") and not r["nom"].startswith("#"):
                    noms[normalitza(r["nom"])] = r["nom"]
    # Del més llarg al més curt, perquè «Joan Melis Riera» no es confongui amb «Joan Melis».
    ordenats = sorted(noms, key=len, reverse=True)

    for cami in sys.argv[2:]:
        text = Path(cami).read_text(encoding="utf-8")
        # «Edició número 156» als PDF nous, «Edició núm. 121» als antics.
        m = re.search(r"Edició (?:número|núm\.) (\d+)", text)
        if not m:
            print(f"  {cami}: no hi trobo el número d'edició", file=sys.stderr)
            continue
        edicio = int(m.group(1))
        files, sense_nom = [], []
        for linia in text.splitlines():
            linia = re.sub("[❶❷❸❹❺]", " ", linia)
            f = FILA.match(linia)
            if not f:
                continue
            p, mig = f.group(1), normalitza(f.group(2))
            nom = next((noms[n] for n in ordenats if mig == n or mig.endswith(" " + n)), None)
            if not nom:
                sense_nom.append(f.group(2).strip())
                continue
            var = f.group(2).split()[0] if p.isdigit() else ""
            vt, dt, pt = num(f.group(11)), num(f.group(12)), int(f.group(13))
            files.append({
                "nom": nom,
                "barruf": int(f.group(3)),
                "estat": "act" if p.isdigit() else p,
                "posicio": int(p) if p.isdigit() else None,
                "deb": var == "deb",
                "vtemp": num(f.group(8)),
                "ptemp": int(f.group(9)),
                "vt": vt,
                "pt": pt,
            })
        (carpeta / f"pdf-{edicio}.json").write_text(json.dumps({"pdf": True, "edicio": edicio, "files": files}, ensure_ascii=False))
        print(f"  {edicio}: {len(files)} jugadors" + (f", sense reconèixer: {sense_nom[:5]}" if sense_nom else ""))


if __name__ == "__main__":
    main()
