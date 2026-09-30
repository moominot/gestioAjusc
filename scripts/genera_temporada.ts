/**
 * Genera la migració d'una temporada sencera a partir dels fulls de l'AJUSC.
 *
 * Cada full del GENERADOR_BARRUF calcula una edició: porta l'estat anterior
 * (`DadesÚltimBarruf`), els resultats del campionat amb els noms ja comprovats
 * (`RESULTATS TORNEIG`, columnes L a P) i l'estat que en surt (`Dades9Barruf`).
 * Amb els fulls de tota una temporada es pot:
 *
 *  - prendre com a llavor l'estat anterior a la primera edició;
 *  - desar-ne tots els campionats, partida per partida;
 *  - rejugar-los amb el motor i desar-ne cada edició.
 *
 * Abans d'escriure res, compara cada edició calculada amb la del full, jugador
 * per jugador. Si alguna cosa no quadra, s'atura i ho diu: una migració així
 * només té sentit si reprodueix exactament el que l'AJUSC ha publicat.
 *
 * Ús:
 *   npx vite-node scripts/genera_temporada.ts -- <carpeta amb els fulls> \
 *     > supabase/migrations/<data>_temporada_<codi>.sql
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { calculaEdicio, type Edicio, type JugadorLlavor } from '../lib/barruf/publicacio'
import type { CampionatEntrada, Resultat } from '../lib/barruf/tipus'
import { llegeixXlsx, type PestanyaFull } from '../lib/importacio/fitxers'
import { construeixTorneigDeFull, interpretaFiles, type TorneigDeFull } from '../lib/importacio/fulls'
import { netejaNom, normalitzaNom } from '../lib/importacio/noms'

/**
 * Jugadors que els fulls han rebatejat respecte de la llavor original (la 199):
 * nom nou → nom antic. Sense això la mateixa persona quedaria en dues fitxes.
 */
const RENOMENATS: Record<string, string> = {
  'Jordi Plana Español': 'Jordi Plana Espanyol',
  'Lourdes Sola': 'Lourdes Sola López',
}

const avis = (text: string) => process.stderr.write(text + '\n')

// --- Lectura dels fulls ---------------------------------------------------------

interface FilaDades {
  ordre: number
  nom: string
  barruf: number
  estat: string
  club: string | null
  vtemp: number
  ptemp: number
  vt: number
  pt: number
  debutant: boolean
  darrera: string | null
  cohort: boolean
  posicio: number | null
}

/** Com `temporada()` de genera_llavor.py: '2025-26', '<=2013-14', 'Rec. 14-15'. */
function temporada(valor: unknown): { codi: string | null; cohort: boolean } {
  if (valor === null || valor === undefined || valor === '') return { codi: null, cohort: false }
  const text = String(valor)
  if (text.startsWith('<=')) return { codi: null, cohort: true }
  const m = text.match(/(\d{2,4})-(\d{2})/)
  if (!m) return { codi: null, cohort: true }
  const any = Number(m[1]) < 100 ? Number(m[1]) + 2000 : Number(m[1])
  return { codi: `${any}-${m[2]}`, cohort: false }
}

function llegeixDades(files: unknown[][], ambPosicio: boolean): FilaDades[] {
  const out: FilaDades[] = []
  files.slice(1).forEach((f, i) => {
    if (!f[0]) return
    const t = temporada(f[9])
    out.push({
      ordre: i + 1,
      nom: netejaNom(String(f[0])),
      barruf: Number(f[1]),
      estat: String(f[2]),
      club: f[3] ? netejaNom(String(f[3])) || null : null,
      vtemp: Number(f[4] ?? 0),
      ptemp: Number(f[5] ?? 0),
      vt: Number(f[6] ?? 0),
      pt: Number(f[7] ?? 0),
      debutant: f[8] === 'deb',
      darrera: t.codi,
      cohort: t.cohort,
      posicio: ambPosicio && typeof f[10] === 'number' ? f[10] : null,
    })
  })
  return out
}

interface FullEdicio {
  numero: number
  fitxer: string
  campionat: string
  temporada: string
  data: string | null
  anterior: FilaDades[]
  nova: FilaDades[]
  totalsAnteriors: { resultats: number; campionats: number }
  torneig: TorneigDeFull
  /** Nom tal com es va picar → nom del BARRUF, quan no coincideixen. */
  alies: [string, string][]
  avisos: string[]
}

function cella(pestanya: PestanyaFull, etiqueta: string): unknown {
  const fila = pestanya.files.find((f) => String(f[0] ?? '').trim().startsWith(etiqueta))
  return fila?.[1]
}

async function llegeixFull(fitxer: string): Promise<FullEdicio | null> {
  const pestanyes = await llegeixXlsx(new Uint8Array(readFileSync(fitxer)))
  const full = (nom: string) => {
    const p = pestanyes.find((x) => x.nom === nom)
    if (!p) throw new Error(`${fitxer}: no hi ha la pestanya ${nom}`)
    return p
  }
  if (!pestanyes.some((p) => p.nom === 'INICI')) return null

  const inici = full('INICI')
  const anteriorNum = Number(cella(inici, 'També has de triar'))
  const resultats = full('RESULTATS TORNEIG').files
  const avisos: string[] = []

  // Els resultats amb els noms comprovats; si no n'hi ha, els originals.
  let files
  try {
    files = interpretaFiles(resultats.slice(1).map((f) => f.slice(11, 16)))
  } catch {
    try {
      files = interpretaFiles(resultats.slice(1).map((f) => f.slice(0, 5)))
      avisos.push('sense noms comprovats: resultats originals')
    } catch {
      return null // Un full sense resultats: la plantilla de la propera edició.
    }
  }

  let torneig: TorneigDeFull
  try {
    torneig = construeixTorneigDeFull(files)
  } catch (error) {
    // Una ronda mal numerada no afecta el BARRUF: es reparteixen de nou.
    avisos.push(`rondes refetes (${(error as Error).message})`)
    torneig = construeixTorneigDeFull(files.map((f) => ({ ...f, ronda: null })))
  }

  const alies: [string, string][] = []
  for (const f of resultats.slice(2)) {
    const picat = f[6] ? netejaNom(String(f[6])) : ''
    const barruf = f[7] ? netejaNom(String(f[7])) : ''
    if (picat && barruf && normalitzaNom(picat) !== normalitzaNom(barruf)) alies.push([picat, barruf])
  }

  const capcalera = full('DadesÚltimBarruf').files[0]
  const despres = (etiqueta: string) => Number(capcalera[capcalera.indexOf(etiqueta) + 1])

  const titol = pestanyes.find((p) => /^\d+Barruf$/.test(p.nom))
  const text = (titol?.files.slice(0, 5) ?? []).map((f) => String(f[0] ?? '')).join(' ')
  const computat = text.match(/Campionat computat: (.*?)(?: Des de|$)/)?.[1]?.trim()

  const data = cella(inici, 'DATA')
  return {
    numero: anteriorNum + 1,
    fitxer: path.basename(fitxer),
    // El de la casella TORNEIG: el títol del PDF de vegades porta errors del full (#N/A).
    campionat: String(cella(inici, 'TORNEIG') ?? computat).trim(),
    temporada: String(cella(inici, 'TEMPORADA')),
    data: data instanceof Date ? data.toISOString().slice(0, 10) : null,
    anterior: llegeixDades(full('DadesÚltimBarruf').files, true),
    nova: llegeixDades(full('Dades9Barruf').files, false),
    totalsAnteriors: {
      resultats: despres('Total res individuals'),
      campionats: despres('Total campionats'),
    },
    torneig,
    alies,
    avisos,
  }
}

function fullsDe(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nom) => {
    const cami = path.join(carpeta, nom)
    if (statSync(cami).isDirectory()) return fullsDe(cami)
    return /^barruf \d{3}.*\.xlsx$/i.test(nom) ? [cami] : []
  })
}

// --- Càlcul i comprovació -------------------------------------------------------

const id = (nom: string) => normalitzaNom(nom)

function comprova(full: FullEdicio, edicio: Edicio, seguent: FullEdicio | undefined): string[] {
  const errors: string[] = []
  const nostres = new Map(edicio.valors.map((v) => [v.jugadorId, v]))
  for (const f of full.nova) {
    if (f.estat === 'nov') continue
    const v = nostres.get(id(f.nom))
    const nom = `${full.numero} ${f.nom}`
    if (!v) { errors.push(`${nom}: no el tenim`); continue }
    const dif = [
      ['BARRUF', v.barruf, f.barruf],
      ['PT', v.partidesTotals, f.pt],
      ['VT', v.victoriesTotals, f.vt],
      ['Ptemp', v.partidesTemporada, f.ptemp],
      ['Vtemp', v.victoriesTemporada, f.vtemp],
      ['estat', v.estat, f.estat],
      ['deb', v.debutant, f.debutant],
    ].filter(([, a, b]) => a !== b)
    if (dif.length) errors.push(`${nom}: ${dif.map(([c, a, b]) => `${c} ${a}≠${b}`).join(', ')}`)
  }
  // Les posicions d'aquesta edició surten a l'estat anterior del full següent.
  if (seguent) {
    for (const f of seguent.anterior) {
      const v = nostres.get(id(f.nom))
      if (f.posicio !== null && v && v.posicio !== f.posicio) {
        errors.push(`${full.numero} ${f.nom}: posició ${v.posicio}≠${f.posicio}`)
      }
    }
  }
  return errors
}

// --- SQL ------------------------------------------------------------------------

const q = (v: unknown): string =>
  v === null || v === undefined ? 'NULL' : typeof v === 'number' || typeof v === 'boolean' ? String(v).toUpperCase() : `'${String(v).replace(/'/g, "''")}'`

async function main() {
  const carpeta = process.argv.slice(2).find((a) => !a.startsWith('-'))
  if (!carpeta) throw new Error('Cal la carpeta amb els fulls de la temporada')

  const fulls: FullEdicio[] = []
  for (const fitxer of fullsDe(carpeta).sort()) {
    const full = await llegeixFull(fitxer)
    if (!full) { avis(`  (sense resultats, se salta: ${path.basename(fitxer)})`); continue }
    if (fulls.some((f) => f.numero === full.numero)) throw new Error(`Dos fulls per a l'edició ${full.numero}`)
    fulls.push(full)
    avis(`  ${full.numero}: ${full.campionat} — ${full.torneig.partides.length} partides${full.avisos.map((a) => ' · ' + a).join('')}`)
  }
  fulls.sort((a, b) => a.numero - b.numero)
  fulls.forEach((f, i) => {
    if (i > 0 && f.numero !== fulls[i - 1].numero + 1) throw new Error(`Falta l'edició ${fulls[i - 1].numero + 1}`)
  })

  const primer = fulls[0]
  const llavorNum = primer.numero - 1
  const temporadaCodi = primer.temporada

  // La llavor: l'estat anterior a la primera edició.
  const llavor: JugadorLlavor[] = primer.anterior
    .filter((f) => f.estat !== 'nov')
    .map((f) => ({
      jugadorId: id(f.nom),
      barruf: f.barruf,
      partidesTotals: f.pt,
      victoriesTotals: f.vt,
      partidesTemporada: f.ptemp,
      victoriesTemporada: f.vtemp,
      darreraTemporada: f.darrera,
      cohortLlegat: f.cohort,
    }))

  // Els campionats, amb els jugadors identificats pel nom normalitzat.
  const campionats: CampionatEntrada[] = fulls.map((full) => {
    const noms = new Map(full.torneig.participants.map((p) => [p.id, id(p.nomComplet)]))
    for (const nom of noms.values()) {
      if (!full.anterior.some((f) => id(f.nom) === nom)) {
        throw new Error(`${full.numero}: «${nom}» juga però no és a la llista del full`)
      }
    }
    return {
      id: String(full.numero),
      temporadaCodi: full.temporada,
      inscrits: [...noms.values()],
      partides: full.torneig.partides.map((p) => ({
        ronda: p.ronda,
        jugador1Id: noms.get(p.blancId)!,
        jugador2Id: p.negreId === null ? null : noms.get(p.negreId)!,
        resultat1: p.resultatBlanc as Resultat,
      })),
    }
  })

  // Cada edició, rejugant des de la llavor, i comprovada contra el seu full.
  const edicions: Edicio[] = []
  const errors: string[] = []
  fulls.forEach((full, i) => {
    const edicio = calculaEdicio(llavor, campionats.slice(0, i + 1), temporadaCodi)
    edicions.push(edicio)
    errors.push(...comprova(full, edicio, fulls[i + 1]))
    // Els totals de la capçalera.
    const seguent = fulls[i + 1]
    if (seguent) {
      const resultats = full.totalsAnteriors.resultats + 2 * full.torneig.partides.length
      // El full de la 210 hi té un #N/A: si no hi ha xifra, no hi ha amb què comparar.
      if (Number.isFinite(seguent.totalsAnteriors.resultats) && resultats !== seguent.totalsAnteriors.resultats) {
        errors.push(`${full.numero}: resultats acumulats ${resultats}≠${seguent.totalsAnteriors.resultats}`)
      }
    }
  })
  if (errors.length) {
    avis(`\n${errors.length} diferències amb els fulls:\n  ${errors.slice(0, 40).join('\n  ')}`)
    if (!process.argv.includes('--força')) throw new Error('No quadra: no s\'escriu la migració')
  } else {
    avis(`\nLes ${fulls.length} edicions quadren amb els fulls, jugador per jugador.`)
  }

  // La llista sencera, en l'ordre del full de l'última edició. Porta tothom:
  // els jugadors nous s'hi afegeixen al final a mesura que apareixen.
  const llista = fulls.at(-1)!.nova
  const perId = new Map(llista.map((f) => [id(f.nom), f]))
  const ordre = (nom: string) => {
    const f = perId.get(id(nom))
    if (!f) throw new Error(`«${nom}» no és a la llista final`)
    return f.ordre
  }

  const l: string[] = []
  const w = (s: string) => l.push(s)

  w(`-- =============================================================================
-- Temporada ${temporadaCodi}: llavor ${llavorNum} i edicions ${primer.numero} a ${fulls.at(-1)!.numero}
-- =============================================================================
-- Generat per scripts/genera_temporada.ts a partir dels fulls de l'AJUSC de
-- cada edició. NO l'editeu a mà: torneu a executar el generador.
--
-- La llavor és l'estat anterior a l'edició ${primer.numero}. Els ${fulls.length} campionats hi
-- són partida per partida, i cada edició és el resultat de rejugar-los amb el
-- motor: el generador ha comprovat que coincideixen jugador per jugador amb
-- les dels fulls abans d'escriure aquest fitxer.
-- =============================================================================

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM campionats) THEN
        RAISE EXCEPTION 'Ja hi ha campionats: aquesta migració només es pot aplicar sobre la llavor.';
    END IF;
END $$;

INSERT INTO temporades (codi, any_inici, data_inici, data_fi) VALUES
${Array.from({ length: 13 }, (_, k) => 2014 + k).map((a) => `    ('${a}-${String(a + 1).slice(2)}', ${a}, DATE '${a}-09-01', DATE '${a + 1}-08-31')`).join(',\n')}
ON CONFLICT (codi) DO NOTHING;
`)

  const clubs = [...new Set(fulls.flatMap((f) => [...f.anterior, ...f.nova]).map((f) => f.club).filter(Boolean))].sort()
  w(`INSERT INTO clubs (nom) VALUES\n${clubs.map((c) => `    (${q(c)})`).join(',\n')}\nON CONFLICT (nom) DO NOTHING;\n`)

  w(`-- -----------------------------------------------------------------------------
-- Els jugadors, en l'ordre del full (${llista.length})
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE llista_full (
    ordre           INTEGER PRIMARY KEY,
    nom             TEXT NOT NULL,
    nom_norm        TEXT NOT NULL,
    nom_antic_norm  TEXT,
    club            TEXT,
    jugador_id      UUID
) ON COMMIT DROP;

INSERT INTO llista_full (ordre, nom, nom_norm, nom_antic_norm, club) VALUES
${llista.map((f) => `    (${f.ordre}, ${q(f.nom)}, ${q(id(f.nom))}, ${q(RENOMENATS[f.nom] ? id(RENOMENATS[f.nom]) : null)}, ${q(f.club)})`).join(',\n')};

DO $$
DECLARE
    r    RECORD;
    v_id UUID;
BEGIN
    FOR r IN SELECT * FROM llista_full ORDER BY ordre LOOP
        SELECT jugador_id INTO v_id FROM jugador_alies WHERE alies_norm = r.nom_norm;

        -- Rebatejat: és la fitxa que ja hi havia, amb el nom nou.
        IF v_id IS NULL AND r.nom_antic_norm IS NOT NULL THEN
            SELECT jugador_id INTO v_id FROM jugador_alies WHERE alies_norm = r.nom_antic_norm;
            IF v_id IS NOT NULL THEN
                UPDATE jugadors SET nom_complet = r.nom WHERE id = v_id;
            END IF;
        END IF;

        IF v_id IS NULL THEN
            INSERT INTO jugadors (nom_complet) VALUES (r.nom) RETURNING id INTO v_id;
        END IF;

        INSERT INTO jugador_alies (jugador_id, alies, alies_norm, origen)
        VALUES (v_id, r.nom, r.nom_norm, 'full de l''AJUSC ${temporadaCodi}')
        ON CONFLICT (alies_norm) DO NOTHING;

        UPDATE jugadors SET
            ordre_llista = r.ordre,
            club_id = (SELECT id FROM clubs WHERE nom = r.club)
        WHERE id = v_id;

        UPDATE llista_full SET jugador_id = v_id WHERE ordre = r.ordre;
    END LOOP;
END $$;

SELECT setval('ordre_llista_seq', (SELECT max(ordre_llista) FROM jugadors));
`)

  const alies = new Map<string, [string, number]>()
  for (const full of fulls) {
    for (const [picat, barruf] of full.alies) alies.set(id(picat), [picat, ordre(barruf)])
  }
  if (alies.size) {
    w(`-- Com es van picar els noms que el full va haver de corregir a mà (${alies.size}).
INSERT INTO jugador_alies (jugador_id, alies, alies_norm, origen)
SELECT l.jugador_id, a.alies, a.alies_norm, 'full de l''AJUSC ${temporadaCodi}'
FROM (VALUES
${[...alies].map(([norm, [picat, o]]) => `    (${q(picat)}, ${q(norm)}, ${o})`).join(',\n')}
) AS a(alies, alies_norm, ordre)
JOIN llista_full l ON l.ordre = a.ordre
ON CONFLICT (alies_norm) DO NOTHING;
`)
  }

  // --- Edicions ------------------------------------------------------------------
  const valorsSql = (numero: number, files: string[]) => `INSERT INTO barruf_valors (
    edicio_id, jugador_id, barruf,
    partides_totals, victories_totals, partides_temporada, victories_temporada,
    estat, darrera_temporada, cohort_llegat, debutant, posicio
)
SELECT e.id, l.jugador_id, v.barruf, v.pt, v.vt, v.ptemp, v.vtemp,
       v.estat::estat_jugador, v.darrera::text, v.cohort, v.deb, v.pos::integer
FROM (VALUES
${files.join(',\n')}
) AS v(ordre, barruf, pt, vt, ptemp, vtemp, estat, darrera, cohort, deb, pos)
JOIN llista_full l ON l.ordre = v.ordre
CROSS JOIN (SELECT id FROM barruf_edicions WHERE numero = ${numero}) e;
`

  w(`-- -----------------------------------------------------------------------------
-- La llavor: l'edició ${llavorNum}
-- -----------------------------------------------------------------------------
DELETE FROM barruf_edicions;

INSERT INTO barruf_edicions (
    numero, data_publicacio, temporada_codi, es_llavor, descripcio,
    resultats_acumulats, campionats_acumulats
) VALUES (
    ${llavorNum}, DATE '${primer.data ?? `${temporadaCodi.slice(0, 4)}-09-01`}', ${q(temporadaCodi)}, TRUE,
    'Punt de partida heretat del full de l''AJUSC: l''estat anterior a l''edició ${primer.numero}.',
    ${primer.totalsAnteriors.resultats}, ${primer.totalsAnteriors.campionats}
);
`)
  w(valorsSql(llavorNum, primer.anterior.filter((f) => f.estat !== 'nov').map((f) =>
    `    (${ordre(f.nom)}, ${f.barruf}, ${f.pt}, ${f.vt}, ${f.ptemp}, ${f.vtemp}, ${q(f.estat)}, ${q(f.darrera)}, ${q(f.cohort)}, ${q(f.debutant)}, ${q(f.posicio)})`)))

  let resultats = primer.totalsAnteriors.resultats
  let nombreCampionats = primer.totalsAnteriors.campionats
  const fiTemporada = `${Number(temporadaCodi.slice(0, 4)) + 1}-08-31`

  fulls.forEach((full, i) => {
    const edicio = edicions[i]
    const campionat = campionats[i]
    const data = full.data ?? fiTemporada
    resultats += 2 * campionat.partides.filter((p) => p.jugador2Id !== null).length
    nombreCampionats += 1

    w(`-- =============================================================================
-- Edició ${full.numero}: ${full.campionat}
-- =============================================================================
INSERT INTO campionats (
    nom, data, temporada_codi, computa_barruf, finalitzat, rondes_jugades,
    ordre, origen, notes, primera_edicio
) VALUES (
    ${q(full.campionat)}, DATE '${data}', ${q(full.temporada)}, TRUE, TRUE, ${full.torneig.rondesJugades.length},
    ${full.numero}, 'full AJUSC',
    ${q(`Importat de ${full.fitxer}${full.data ? '' : '. Sense data al full: es posa la de final de temporada.'}${full.avisos.length ? ' ' + full.avisos.join('; ') + '.' : ''}`)},
    ${full.numero}
);

INSERT INTO inscripcions (campionat_id, jugador_id)
SELECT c.id, l.jugador_id
FROM (VALUES ${campionat.inscrits.map((n) => `(${ordre(perId.get(n)!.nom)})`).join(', ')}) AS i(ordre)
JOIN llista_full l ON l.ordre = i.ordre
CROSS JOIN (SELECT id FROM campionats WHERE primera_edicio = ${full.numero}) c;

INSERT INTO partides (campionat_id, ronda, jugador_1_id, jugador_2_id, resultat_1, punts_1, punts_2)
SELECT c.id, p.ronda, l1.jugador_id, l2.jugador_id, p.resultat, p.punts_1::integer, p.punts_2::integer
FROM (VALUES
${full.torneig.partides.map((p, k) => {
  const noms = new Map(full.torneig.participants.map((x) => [x.id, x.nomComplet]))
  const o1 = ordre(noms.get(p.blancId)!)
  const o2 = p.negreId === null ? 'NULL' : String(ordre(noms.get(p.negreId)!))
  return `    (${campionat.partides[k].ronda}, ${o1}, ${o2}, ${p.resultatBlanc}, ${q(p.puntsBlanc)}, ${q(p.puntsNegre)})`
}).join(',\n')}
) AS p(ronda, o1, o2, resultat, punts_1, punts_2)
JOIN llista_full l1 ON l1.ordre = p.o1
LEFT JOIN llista_full l2 ON l2.ordre = p.o2
CROSS JOIN (SELECT id FROM campionats WHERE primera_edicio = ${full.numero}) c;

INSERT INTO barruf_edicions (
    numero, data_publicacio, temporada_codi, descripcio,
    campionats_computats, resultats_acumulats, campionats_acumulats
) VALUES (
    ${full.numero}, DATE '${data}', ${q(full.temporada)},
    'Rejugada a partir dels resultats del full de l''AJUSC.',
    ${q(full.campionat)}, ${resultats}, ${nombreCampionats}
);
`)
    w(valorsSql(full.numero, edicio.valors.map((v) =>
      `    (${ordre(perId.get(v.jugadorId)!.nom)}, ${v.barruf}, ${v.partidesTotals}, ${v.victoriesTotals}, ${v.partidesTemporada}, ${v.victoriesTemporada}, ${q(v.estat)}, ${q(v.darreraTemporada)}, ${q(v.cohortLlegat)}, ${q(v.debutant)}, ${q(v.posicio)})`)))
  })

  // Les variacions de tota la cadena, com les deixa publica_edicio().
  const variacions = edicions.at(-1)!.variacions
  w(`-- El detall auditable de cada campionat.
INSERT INTO barruf_variacions (
    campionat_id, jugador_id, barruf_abans, partides, victories,
    esperanca, factor_k, variacio, barruf_despres
)
SELECT c.id, l.jugador_id, v.abans, v.partides, v.victories, v.esperanca, v.k, v.variacio, v.despres
FROM (VALUES
${[...variacions].flatMap(([camp, vs]) => vs.map((v) =>
  `    (${camp}, ${ordre(perId.get(v.jugadorId)!.nom)}, ${v.barrufAbans}, ${v.partides}, ${v.victories}, ${v.esperanca.toFixed(6)}, ${v.factorK}, ${v.variacio.toFixed(4)}, ${v.barrufDespres})`)).join(',\n')}
) AS v(edicio, ordre, abans, partides, victories, esperanca, k, variacio, despres)
JOIN llista_full l ON l.ordre = v.ordre
JOIN campionats c ON c.primera_edicio = v.edicio;

COMMIT;`)

  process.stdout.write(l.join('\n') + '\n')
}

main().catch((error) => {
  avis(`\n${(error as Error).message}`)
  process.exit(1)
})
