/**
 * Genera la migració de l'arxiu: les edicions anteriors a la llavor i els seus
 * campionats, a partir dels JSON que escriu `scripts/extreu_arxiu.py`.
 *
 * Les edicions es desen tal com les va publicar l'AJUSC (el `Dades9Barruf` de
 * cada full). El motor no les recalcula: només serveix per comprovar cada
 * campionat, calcular-ne l'esperança i el factor K de cada jugador i omplir les
 * edicions de les quals el full ha arribat trencat. Aquestes últimes s'han
 * d'encadenar exactament fins a la llavor, i si no, el generador s'atura.
 *
 * Ús:
 *   npx vite-node scripts/genera_arxiu.ts -- <carpeta dels JSON> <llavor> \
 *     > supabase/migrations/<data>_arxiu.sql
 */

import { readFileSync, readdirSync } from 'node:fs'

import { LLINDAR_PARTIDES_ACTIU } from '../lib/barruf/constants'
import { calculaEstat } from '../lib/barruf/estats'
import { aplicaCampionat, calculaCampionat } from '../lib/barruf/motor'
import { esDebutant } from '../lib/barruf/publicacio'
import type { CampionatEntrada, EstatBarruf, PartidaResolta, Resultat } from '../lib/barruf/tipus'
import { normalitzaNom } from '../lib/importacio/noms'
import { semblanca } from '../lib/importacio/resolucio'

const avis = (text: string) => process.stderr.write(text + '\n')

// --- Dades extretes -------------------------------------------------------------

interface Fila {
  nom: string
  barruf: number | null
  estat: string | null
  club: string | null
  vtemp: number
  ptemp: number
  vt: number
  pt: number
  deb: boolean
  darrera: string | null
}

type Partida = [number | null, string, number | null, string | null, number | null]

interface Full {
  fitxer: string
  edicio: number
  campionat: string | null
  data: string | null
  temporada: string | null
  anterior: Fila[]
  nova: Fila[]
  partides?: { comprovats: Partida[]; originals: Partida[] }
  aparellaments?: { nom: string; victories: number; rivals: (string | null)[] }[]
  alies?: [string, string][]
  origen?: string
}

const id = (nom: string) => normalitzaNom(nom)
const escombraria = (f: Fila) => !f.nom || f.nom.startsWith('#') || esNumero(f.nom) || typeof f.barruf !== 'number'
const netes = (files: Fila[]) => files.filter((f) => !escombraria(f))
/** Una pestanya és bona si gairebé totes les files tenen BARRUF. */
const valida = (files: Fila[]) => files.length > 50 && netes(files).length > files.length * 0.8

function temporadaDe(full: Full): string {
  if (full.temporada && /^\d{4}-\d{2}$/.test(full.temporada)) return full.temporada
  const m = full.fitxer.match(/(20\d\d-\d\d)/)
  if (!m) throw new Error(`${full.fitxer}: no sé de quina temporada és`)
  return m[1]
}

function darrera(valor: string | null): { codi: string | null; cohort: boolean } {
  if (!valor) return { codi: null, cohort: false }
  if (valor.startsWith('<=')) return { codi: null, cohort: true }
  // «2014-15», «14-15» i també «2014-2015», que n'hi ha.
  const m = valor.match(/(\d{2,4})\s*-\s*(\d{2,4})/)
  if (!m) return { codi: null, cohort: true }
  const any = Number(m[1]) < 100 ? Number(m[1]) + 2000 : Number(m[1])
  return { codi: `${any}-${String(any + 1).slice(2)}`, cohort: false }
}

// --- El campionat de cada full, en les versions possibles -----------------------

type Variant = 'comprovats' | 'originals' | 'aparellaments'

interface Campionat {
  entrada: CampionatEntrada
  /** Per desar: partides amb ronda sense repeticions per jugador. */
  partides: { ronda: number; j1: string; j2: string | null; resultat: Resultat | null; p1: number | null; p2: number | null }[]
  noms: Map<string, string>
}

function resultat(p1: number | null, p2: number | null): Resultat | null {
  if (p1 === null || p2 === null) return null
  if ([0, 0.5, 1].includes(p1) && p1 + p2 === 1) return p1 as Resultat
  return p1 > p2 ? 1 : p1 < p2 ? 0 : 0.5
}

/** Rondes sense que ningú en repeteixi cap: les del full si es pot, i si no, repartides. */
function rondesSenseRepetir(partides: { ronda: number; j1: string; j2: string | null }[]): number[] {
  const ocupat = new Set<string>()
  const repeteix = partides.some((p) =>
    [p.j1, p.j2].filter(Boolean).some((j) => {
      const clau = `${p.ronda}|${j}`
      if (ocupat.has(clau)) return true
      ocupat.add(clau)
      return false
    }),
  )
  if (!repeteix) return partides.map((p) => p.ronda)
  const perRonda: Set<string>[] = []
  return partides.map((p) => {
    let r = 0
    while (perRonda[r] && [p.j1, p.j2].some((j) => j && perRonda[r].has(j))) r++
    perRonda[r] ??= new Set()
    for (const j of [p.j1, p.j2]) if (j) perRonda[r].add(j)
    return r + 1
  })
}

function campionatDe(full: Full, variant: Variant, numero: number, resol: (nom: string) => string | null): Campionat | null {
  const noms = new Map<string, string>()
  // Cada nom, al del jugador que li correspon; `null` si no és un jugador (BYE).
  const nom = (n: string): string | null => {
    const jid = resol(n)
    if (jid && !noms.has(jid)) noms.set(jid, n)
    return jid
  }
  let crues: Campionat['partides'] = []
  let victories: Record<string, number> | undefined

  if (variant === 'aparellaments') {
    if (!full.aparellaments?.length) return null
    victories = {}
    const vist = new Set<string>()
    for (const j of full.aparellaments) {
      const a = nom(j.nom)
      if (!a) continue
      victories[a] = j.victories
      j.rivals.forEach((rival, i) => {
        const b = rival ? nom(rival) : null
        if (!b) return
        const clau = `${i}|${[a, b].sort().join('|')}`
        if (vist.has(clau)) return
        vist.add(clau)
        crues.push({ ronda: i + 1, j1: a, j2: b, resultat: null, p1: null, p2: null })
      })
    }
  } else {
    const files = full.partides?.[variant]
    if (!files?.length) return null
    for (const [ronda, n1, p1, n2, p2] of files) {
      let j1 = n1 ? nom(n1) : null
      let j2 = n2 ? nom(n2) : null
      let [q1, q2] = [p1, p2]
      // Si el que no hi és és el primer, el que juga passa al davant.
      if (!j1 && j2) [j1, j2, q1, q2] = [j2, null, p2, p1]
      if (!j1) continue
      crues.push({ ronda: Number(ronda) || 1, j1, j2, resultat: j2 ? resultat(q1, q2) : 1, p1: j2 ? q1 : null, p2: j2 ? q2 : null })
    }
    // Fora les puntuacions que no ho són (resultats 1-0).
    crues = crues.map((p) => (p.p1 !== null && p.p2 !== null && [0, 0.5, 1].includes(p.p1) && p.p1 + p.p2 === 1 ? { ...p, p1: null, p2: null } : p))
  }
  // Una partida contra si mateix no existeix: surt de dos noms del mateix
  // jugador o d'un full antic que es posa ell mateix de rival.
  crues = crues.filter((p) => p.j1 !== p.j2)
  const rondes = rondesSenseRepetir(crues)
  crues = crues.map((p, i) => ({ ...p, ronda: rondes[i] }))

  const inscrits = [...new Set(crues.flatMap((p) => [p.j1, p.j2]).filter((j): j is string => !!j))]
  if (victories) for (const j of Object.keys(victories)) if (!inscrits.includes(j)) inscrits.push(j)
  const partides: PartidaResolta[] = crues.map((p) => ({ ronda: p.ronda, jugador1Id: p.j1, jugador2Id: p.j2, resultat1: p.resultat }))
  return {
    entrada: { id: String(numero), inscrits, partides, temporadaCodi: temporadaDe(full), victories, arrodoneix: numero >= 142 },
    partides: crues,
    noms,
  }
}

/**
 * Si les paraules de `curt` són dins de `llarg` en el mateix ordre. Una inicial
 * («a.») val per qualsevol paraula que comenci per aquesta lletra. Cal que
 * coincideixin almenys la primera i l'última.
 */
function conte(llarg: string, curt: string): boolean {
  const l = llarg.split(' ')
  const c = curt.split(' ')
  if (c.length < 2 || c.length > l.length) return false
  const iguals = (a: string, b: string) =>
    a === b || (a.endsWith('.') && b.startsWith(a.slice(0, -1))) || (b.endsWith('.') && a.startsWith(b.slice(0, -1)))
  if (!iguals(l[0], c[0]) || !iguals(l.at(-1)!, c.at(-1)!)) return false
  let i = 0
  for (const paraula of l) if (i < c.length && iguals(paraula, c[i])) i++
  return i === c.length && (c.length < l.length || c.some((p, k) => p !== l[k]))
}

/** Un «nom» que és un número: el BARRUF d'una columna desplaçada dels fulls antics. */
const esNumero = (nom: string) => /^[\d.,\s]+$/.test(nom)

/**
 * Canvis de nom entre edicions consecutives, com a nom normalitzat antic → nom
 * d'ara. Una baixa i una alta amb les mateixes partides i victòries totals
 * (i almenys una partida) és la mateixa persona rebatejada. S'encadenen: si
 * un nom canvia dues vegades, el primer porta directament al darrer.
 */
/** El nom antic tal com s'escrivia, per desar-lo com a àlies. */
const NOMS_ANTICS = new Map<string, string>()

function detectaRenoms(perEdicio: Map<number, Full[]>, primera: number, darrera: number): Map<string, string> {
  const llista = (n: number, quina: 'anterior' | 'nova') =>
    (perEdicio.get(n) ?? []).map((f) => f[quina]).find((files) => valida(files))
  const directes = new Map<string, string>()
  for (let n = primera + 1; n <= darrera; n++) {
    const abans = llista(n - 1, 'nova')
    const ara = llista(n, 'anterior') ?? llista(n, 'nova')
    if (!abans || !ara) continue
    const noms = new Set(netes(ara).map((f) => id(f.nom)))
    const eren = new Set(netes(abans).map((f) => id(f.nom)))
    const baixes = netes(abans).filter((f) => !noms.has(id(f.nom)) && f.pt > 0)
    const altes = netes(ara).filter((f) => !eren.has(id(f.nom)) && f.pt > 0)
    for (const b of baixes) {
      const iguals = altes.filter((a) => a.pt === b.pt && a.vt === b.vt)
      if (iguals.length === 1) {
        directes.set(id(b.nom), iguals[0].nom)
        NOMS_ANTICS.set(id(b.nom), b.nom)
      }
    }
  }
  const final = new Map<string, string>()
  for (const [antic, nou] of directes) {
    let desti = nou
    for (let i = 0; i < 10 && directes.has(id(desti)); i++) desti = directes.get(id(desti))!
    final.set(antic, desti)
  }
  return final
}

function aplicaRenoms(full: Full, renoms: Map<string, string>) {
  const nom = (n: string) => renoms.get(id(n)) ?? n
  for (const f of [...full.anterior, ...full.nova]) f.nom = nom(f.nom)
  for (const v of ['comprovats', 'originals'] as const) {
    for (const p of full.partides?.[v] ?? []) {
      if (p[1]) p[1] = nom(p[1])
      if (p[3]) p[3] = nom(p[3])
    }
  }
  for (const a of full.aparellaments ?? []) {
    a.nom = nom(a.nom)
    a.rivals = a.rivals.map((r) => (r ? nom(r) : r))
  }
  full.alies = (full.alies ?? []).map(([picat, barruf]) => [picat, nom(barruf)])
}

/** Noms que no són jugadors: descansos i caselles de relleu. */
const NO_JUGADORS = /^(bye|descans|descansa|no juga|no jugat|-+|\?)$/

/**
 * Resolució de noms per a una edició.
 *
 * Els resultats originals porten els noms tal com es van picar. Es passen al
 * de la llista del full per aquest ordre: el mateix nom, un àlies validat pel
 * full (la taula de comprovació de qualsevol edició), un nom que és el
 * principi de l'altre («Salvador Batlle Girbau» → «Salvador Batlle», o un nom
 * tallat del PDF) si només n'hi ha un, i finalment el més semblant si ho és
 * prou i no n'hi ha cap altre a prop. Si no, és un jugador nou.
 */
function resolutor(coneguts: Map<string, string>, alies: Map<string, string>, registre: Map<string, [string, string]>) {
  const llista = [...coneguts.keys()]
  const cache = new Map<string, string | null>()
  return (cru: string): string | null => {
    const n = id(cru)
    if (cache.has(n)) return cache.get(n)!
    let r: string | null = n
    if (NO_JUGADORS.test(n) || esNumero(n)) r = null
    else if (coneguts.has(n)) r = n
    else if (alies.has(n)) r = alies.get(n)!
    else {
      const prefix = llista.filter((k) => n.startsWith(k + ' ') || k.startsWith(n + ' '))
      // Les paraules d'un nom dins de l'altre, en ordre, amb les inicials:
      // «Pia Verger» → «Pia Ona Verger», «Joana Aina Matas» → «Joana A. Matas».
      const dins = llista.filter((k) => conte(k, n) || conte(n, k))
      if (prefix.length === 1) r = prefix[0]
      else if (dins.length === 1) r = dins[0]
      else {
        const puntuades = llista.map((k) => [k, semblanca(n, k)] as const).sort((a, b) => b[1] - a[1])
        const [primer, segon] = puntuades
        if (primer && primer[1] >= 0.85 && (!segon || primer[1] - segon[1] >= 0.05)) r = primer[0]
      }
    }
    if (r && r !== n) registre.set(n, [cru, r])
    cache.set(n, r)
    return r
  }
}

const aEstat = (f: Fila): EstatBarruf => ({
  jugadorId: id(f.nom),
  barruf: f.barruf!,
  partidesTotals: f.pt,
  victoriesTotals: f.vt,
  partidesTemporada: f.ptemp,
  victoriesTemporada: f.vtemp,
  darreraTemporada: darrera(f.darrera).codi,
})

/** Quants participants quadren: el motor sobre `anterior` contra `esperat`. */
function quadra(c: Campionat, anterior: Fila[], esperat: Fila[], numero: number) {
  const estat = new Map(netes(anterior).map((f) => [id(f.nom), aEstat(f)]))
  const despres = aplicaCampionat(c.entrada, estat, calculaCampionat(c.entrada, estat))
  const perNom = new Map(netes(esperat).map((f) => [id(f.nom), f]))
  const tolerancia = numero >= 142 ? 0.5 : 0.01
  let ok = 0
  for (const j of c.entrada.inscrits) {
    const e = perNom.get(j)
    const d = despres.get(j)
    if (e && d && Math.abs(d.barruf - e.barruf!) < tolerancia && d.partidesTotals === e.pt && Math.abs(d.victoriesTotals - e.vt) < 1e-9) ok++
  }
  return { ok, de: c.entrada.inscrits.length, despres }
}

// --- Principal -----------------------------------------------------------------

async function main() {
  const [carpeta, llavorText] = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const llavor = Number(llavorText)
  if (!carpeta || !llavor) throw new Error('Ús: genera_arxiu.ts <carpeta dels JSON> <número de la llavor>')

  const perEdicio = new Map<number, Full[]>()
  // Els PDF llegits per llegeix_pdf_barruf.py, per a les edicions de full trencat.
  const pdfs = new Map<number, Fila[]>()
  for (const f of readdirSync(carpeta)) {
    const dades = JSON.parse(readFileSync(`${carpeta}/${f}`, 'utf8'))
    if (dades.pdf) {
      pdfs.set(dades.edicio, dades.files.map((r: Omit<Fila, 'club' | 'darrera'>) => ({ ...r, club: null, darrera: null })))
      continue
    }
    const full = dades as Full
    if (full.edicio && full.edicio <= llavor + 1) perEdicio.set(full.edicio, [...(perEdicio.get(full.edicio) ?? []), full])
  }
  const primera = Math.min(...perEdicio.keys())

  // Canvis de nom: d'una edició a la següent desapareix un nom i n'apareix un
  // altre amb les mateixes partides i victòries. És la mateixa persona, i tot
  // l'arxiu passa a portar el nom d'ara («Mateu Matas» → «Mateu Xurí»).
  // Els noms que el generador ha hagut de resoldre, per desar-los com a àlies.
  const resolts = new Map<string, [string, string]>()
  const renoms = detectaRenoms(perEdicio, primera, llavor + 1)
  for (const fulls of perEdicio.values()) for (const f of fulls) aplicaRenoms(f, renoms)
  for (const files of pdfs.values()) for (const f of files) f.nom = renoms.get(id(f.nom)) ?? f.nom
  for (const [antic, nou] of renoms) resolts.set(antic, [NOMS_ANTICS.get(antic) ?? antic, id(nou)])
  if (renoms.size) avis(`  Canvis de nom: ${[...renoms].map(([a, b]) => `${a} → ${b}`).join(' · ')}`)

  // Els noms d'avui: la llista de la llavor, com la deixa el full de la següent.
  const actual = perEdicio.get(llavor + 1)?.find((f) => valida(f.anterior))
  if (!actual) throw new Error(`No hi ha el full de l'edició ${llavor + 1} per saber la llista de la llavor`)

  interface Edicio {
    numero: number
    temporada: string
    data: string | null
    campionat: string
    fitxer: string
    variant: Variant
    anterior: Fila[]
    nova: Fila[]
    /** D'on surt l'estat final quan no és el del full: el PDF publicat o el motor. */
    novaCalculada: false | 'pdf' | 'motor'
    comprovacio: { ok: number; de: number }
    c: Campionat
    alies: [string, string][]
  }
  const edicions: Edicio[] = []
  let novaAnterior: Fila[] | null = null

  // Els àlies que els fulls van validar, de totes les edicions.
  const aliesFulls = new Map<string, string>()
  for (const fulls of perEdicio.values()) {
    for (const f of fulls) for (const [picat, barruf] of f.alies ?? []) aliesFulls.set(id(picat), id(barruf))
  }

  for (let n = primera; n <= llavor; n++) {
    const fulls = perEdicio.get(n) ?? []
    if (!fulls.length) throw new Error(`Falta l'edició ${n}`)

    // Totes les combinacions de full, estat de partida i versió dels resultats;
    // es queda la que més quadra amb l'estat final del mateix full.
    let millor: (Omit<Edicio, 'nova' | 'novaCalculada'> & { esperat: Fila[] | null; despres: Map<string, EstatBarruf> }) | null = null
    for (const full of fulls) {
      const anteriors = [valida(full.anterior) ? full.anterior : null, novaAnterior].filter((a): a is Fila[] => !!a)
      // L'estat final publicat: el del full, o el del PDF si el full és trencat.
      const esperat = valida(full.nova) ? full.nova : (pdfs.get(n) ?? null)
      for (const anterior of anteriors) {
        const coneguts = new Map(netes([...anterior, ...(esperat ?? [])]).map((f) => [id(f.nom), f.nom]))
        const resol = resolutor(coneguts, aliesFulls, resolts)
        for (const v of ['comprovats', 'originals', 'aparellaments'] as Variant[]) {
          const c = campionatDe(full, v, n, resol)
          if (!c) continue
          const r = esperat ? quadra(c, anterior, esperat, n) : { ...quadra(c, anterior, anterior, n), ok: 0 }
          // Mana quants participants quadren, no el percentatge: uns resultats
          // «comprovats» retallats a un sol jugador quadrarien al 100%. Si no hi ha
          // amb què comparar, la versió amb més partides.
          const puntuacio = (x: { ok: number; de: number }, partides: number) => (esperat ? x.ok * 1e6 : 0) + partides
          if (!millor || puntuacio(r, c.partides.length) > puntuacio(millor.comprovacio, millor.c.partides.length)) {
            millor = {
              numero: n,
              temporada: temporadaDe(full),
              data: full.data,
              campionat: full.campionat ?? `Campionat de l'edició ${n}`,
              fitxer: full.fitxer,
              variant: v,
              anterior,
              comprovacio: { ok: r.ok, de: r.de },
              c,
              alies: full.alies ?? [],
              esperat,
              despres: r.despres,
            }
          }
        }
      }
    }
    if (!millor) throw new Error(`L'edició ${n} no té cap campionat llegible`)

    // L'estat final: el del full si és bo. Si no, el calculat pel motor, amb els
    // valors del PDF publicat per sobre per als jugadors que hi surten.
    let nova: Fila[]
    let novaCalculada: Edicio['novaCalculada'] = false
    const delFull = fulls.some((f) => f.nova === millor!.esperat)
    if (millor.esperat && delFull) nova = millor.esperat
    else {
      novaCalculada = millor.esperat ? 'pdf' : 'motor'
      const perNom = new Map(netes(millor.anterior).map((f) => [id(f.nom), { ...f }]))
      for (const [jid, e] of millor.despres) {
        const previ = perNom.get(jid)
        perNom.set(jid, {
          nom: previ?.nom ?? millor.c.noms.get(jid) ?? jid,
          barruf: e.barruf,
          estat: calculaEstat({ partidesTotals: e.partidesTotals, darreraTemporada: e.darreraTemporada, temporadaActual: millor.temporada }),
          club: previ?.club ?? null,
          vtemp: e.victoriesTemporada,
          ptemp: e.partidesTemporada,
          vt: e.victoriesTotals,
          pt: e.partidesTotals,
          deb: esDebutant(e.partidesTotals, e.partidesTemporada),
          darrera: e.darreraTemporada,
        })
      }
      for (const p of millor.esperat ?? []) {
        const previ = perNom.get(id(p.nom))
        perNom.set(id(p.nom), { ...p, club: previ?.club ?? null, darrera: previ?.darrera ?? p.darrera })
      }
      nova = [...perNom.values()]
    }
    const { esperat: _e, despres: _d, ...resta } = millor
    edicions.push({ ...resta, nova, novaCalculada })
    novaAnterior = nova
    avis(`  ${n}: ${millor.comprovacio.ok}/${millor.comprovacio.de} · ${millor.variant}${novaCalculada ? ` · estat del ${novaCalculada}` : ''} · ${millor.fitxer.slice(-50)}`)
  }

  // Les edicions calculades han d'arribar exactament a la llavor.
  const darrera_ = edicions.at(-1)!
  if (darrera_.novaCalculada) {
    const llavorFull = new Map(netes(actual.anterior).map((f) => [id(f.nom), f]))
    const dif = netes(darrera_.nova).filter((f) => {
      const l = llavorFull.get(id(f.nom))
      return !l || Math.abs(l.barruf! - f.barruf!) > 1e-9 || l.pt !== f.pt || l.vt !== f.vt
    })
    if (dif.length) {
      avis(`\nLes edicions calculades no arriben a la llavor: ${dif.length} diferències, p. ex. ${dif.slice(0, 3).map((f) => f.nom).join(', ')}`)
      for (const f of dif.slice(0, 25)) {
        const l = llavorFull.get(id(f.nom))
        avis(`    ${f.nom}: nostre ${f.barruf}/${f.pt}p/${f.vt}v · llavor ${l?.barruf}/${l?.pt}p/${l?.vt}v`)
      }
      if (!process.argv.includes('--força')) throw new Error('No quadra amb la llavor')
    } else avis(`\nLes edicions calculades arriben exactament a la llavor ${llavor}.`)
  }

  avis(`
${resolts.size} noms resolts contra la llista: ${[...resolts.values()].slice(0, 12).map(([a, b]) => `${a} → ${b}`).join(" · ")}`)
  process.stdout.write(sql(edicions, actual.anterior, llavor, resolts))
}

// --- SQL -----------------------------------------------------------------------

const q = (v: unknown): string =>
  v === null || v === undefined
    ? 'NULL'
    : typeof v === 'number' || typeof v === 'boolean'
      ? String(v).toUpperCase()
      : `'${String(v).replace(/'/g, "''")}'`

function sql(edicions: any[], llistaLlavor: Fila[], llavor: number, resolts: Map<string, [string, string]>): string {
  const l: string[] = []
  const w = (s: string) => l.push(s)
  const primera = edicions[0].numero
  // Les temporades que surten com a «darrera temporada» dels jugadors, que
  // arriben fins a principis de segle.
  const anys = edicions
    .flatMap((e: any) => [...netes(e.anterior), ...netes(e.nova)].map((f: Fila) => darrera(f.darrera).codi))
    .filter((c: string | null): c is string => !!c)
    .map((c: string) => Number(c.slice(0, 4)))
  const primerAny = Math.min(2014, ...anys)

  // Tots els noms que surten a l'arxiu. Els d'avui ja són a la base de dades
  // (els va crear la migració de la temporada); els altres s'hi afegeixen.
  const noms = new Map<string, string>()
  for (const f of netes(llistaLlavor)) noms.set(id(f.nom), f.nom)
  for (const e of edicions) {
    for (const f of [...netes(e.anterior), ...netes(e.nova)]) if (!noms.has(id(f.nom))) noms.set(id(f.nom), f.nom)
    for (const [jid, nom] of e.c.noms) if (!noms.has(jid)) noms.set(jid, nom)
  }

  // Resultats acumulats de la capçalera, cap enrere des de la llavor.
  const acumulats = new Map<number, { resultats: number; campionats: number }>()

  w(`-- =============================================================================
-- L'arxiu: edicions ${primera - 1} a ${llavor - 1} i els campionats ${primera} a ${llavor}
-- =============================================================================
-- Generat per scripts/genera_arxiu.ts a partir dels fulls de l'AJUSC de cada
-- edició. NO l'editeu a mà.
--
-- Les edicions són les publicades (Dades9Barruf de cada full). Els campionats hi
-- són amb les partides, o amb els aparellaments i les victòries totals quan el
-- full no en guardava més. No entren a la cadena que es rejuga, que arrenca de
-- la llavor (la ${llavor}).
-- =============================================================================

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM barruf_edicions WHERE numero = ${llavor} AND es_llavor) THEN
        RAISE EXCEPTION 'Cal la llavor ${llavor}: aplica abans la migració de la temporada.';
    END IF;
    IF EXISTS (SELECT 1 FROM barruf_edicions WHERE numero < ${llavor}) THEN
        RAISE EXCEPTION 'L''arxiu ja hi és.';
    END IF;
END $$;

INSERT INTO temporades (codi, any_inici, data_inici, data_fi) VALUES
${Array.from({ length: 2027 - primerAny }, (_, k) => primerAny + k).map((a) => `    ('${a}-${String(a + 1).slice(2)}', ${a}, DATE '${a}-09-01', DATE '${a + 1}-08-31')`).join(',\n')}
ON CONFLICT (codi) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Els jugadors de l'arxiu (${noms.size}): els que no hi són, s'hi afegeixen
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE noms_arxiu (nom TEXT, nom_norm TEXT PRIMARY KEY, jugador_id UUID) ON COMMIT DROP;
INSERT INTO noms_arxiu (nom, nom_norm) VALUES
${[...noms].map(([norm, nom]) => `    (${q(nom)}, ${q(norm)})`).join(',\n')};

UPDATE noms_arxiu n SET jugador_id = a.jugador_id FROM jugador_alies a WHERE a.alies_norm = n.nom_norm;

DO $$
DECLARE r RECORD; v_id UUID;
BEGIN
    FOR r IN SELECT * FROM noms_arxiu WHERE jugador_id IS NULL ORDER BY nom LOOP
        INSERT INTO jugadors (nom_complet) VALUES (r.nom) RETURNING id INTO v_id;
        INSERT INTO jugador_alies (jugador_id, alies, alies_norm, origen)
        VALUES (v_id, r.nom, r.nom_norm, 'arxiu del BARRUF');
        UPDATE noms_arxiu SET jugador_id = v_id WHERE nom_norm = r.nom_norm;
    END LOOP;
END $$;
`)

  // Àlies: com es van picar els noms que el full corregia.
  const alies = new Map<string, [string, string]>()
  for (const e of edicions) for (const [picat, barruf] of e.alies) if (id(picat) !== id(barruf)) alies.set(id(picat), [picat, id(barruf)])
  for (const [norm, [cru, desti]] of resolts) if (!alies.has(norm)) alies.set(norm, [cru, desti])
  if (alies.size) {
    w(`INSERT INTO jugador_alies (jugador_id, alies, alies_norm, origen)
SELECT n.jugador_id, a.alies, a.norm, 'arxiu del BARRUF'
FROM (VALUES
${[...alies].map(([norm, [picat, de]]) => `    (${q(picat)}, ${q(norm)}, ${q(de)})`).join(',\n')}
) AS a(alies, norm, de)
JOIN noms_arxiu n ON n.nom_norm = a.de
ON CONFLICT (alies_norm) DO NOTHING;
`)
  }

  const posicions = (files: Fila[]) => {
    const actius = netes(files).filter((f) => f.estat === 'act').map((f) => f.barruf!)
    return (f: Fila) => (f.estat === 'act' ? 1 + actius.filter((b) => b > f.barruf!).length : null)
  }
  const valors = (numero: number, files: Fila[]) => {
    const pos = posicions(files)
    const bones = netes(files).filter((f) => f.estat && ['nov', 'exp', 'act', 'inact'].includes(f.estat))
    const vistos = new Set<string>()
    return `INSERT INTO barruf_valors (
    edicio_id, jugador_id, barruf, partides_totals, victories_totals,
    partides_temporada, victories_temporada, estat, darrera_temporada, cohort_llegat, debutant, posicio
)
SELECT e.id, n.jugador_id, v.barruf, v.pt, v.vt, v.ptemp, v.vtemp, v.estat::estat_jugador, v.darrera::text, v.cohort, v.deb, v.pos::integer
FROM (VALUES
${bones
  .filter((f) => !vistos.has(id(f.nom)) && vistos.add(id(f.nom)))
  .map((f) => {
    const d = darrera(f.darrera)
    return `    (${q(id(f.nom))}, ${Number(f.barruf!.toFixed(4))}, ${Math.round(f.pt)}, ${f.vt}, ${Math.round(f.ptemp)}, ${f.vtemp}, ${q(f.estat)}, ${q(d.codi)}, ${q(d.cohort)}, ${q(f.deb && f.pt > LLINDAR_PARTIDES_ACTIU)}, ${q(pos(f))})`
  })
  .join(',\n')}
) AS v(norm, barruf, pt, vt, ptemp, vtemp, estat, darrera, cohort, deb, pos)
JOIN noms_arxiu n ON n.nom_norm = v.norm
CROSS JOIN (SELECT id FROM barruf_edicions WHERE numero = ${numero}) e;
`
  }

  // Resultats acumulats, cap enrere des dels de la llavor.
  const partidesDe = (e: any) => e.c.partides.filter((p: any) => p.j2).length
  w(`CREATE TEMP TABLE acumulats AS SELECT resultats_acumulats AS r, campionats_acumulats AS c FROM barruf_edicions WHERE numero = ${llavor};\n`)
  let resta = 0
  let restaCampionats = 0
  for (let i = edicions.length - 1; i >= 0; i--) {
    resta += 2 * partidesDe(edicions[i])
    restaCampionats += 1
    acumulats.set(edicions[i].numero - 1, { resultats: resta, campionats: restaCampionats })
  }

  // Edició anterior a la primera: el punt de partida de l'arxiu.
  const primeraEd = edicions[0]
  const edicio = (numero: number, data: string, temporada: string, computats: string | null, descripcio: string) => {
    const a = acumulats.get(numero)
    return `INSERT INTO barruf_edicions (numero, data_publicacio, temporada_codi, es_llavor, descripcio, campionats_computats, resultats_acumulats, campionats_acumulats)
SELECT ${numero}, DATE '${data}', ${q(temporada)}, FALSE, ${q(descripcio)}, ${q(computats)}, acumulats.r - ${a?.resultats ?? 0}, acumulats.c - ${a?.campionats ?? 0} FROM acumulats;
`
  }
  const fiTemporada = (t: string) => `${Number(t.slice(0, 4)) + 1}-08-31`

  w(`-- Edició ${primeraEd.numero - 1}: el punt de partida de l'arxiu`)
  w(edicio(primeraEd.numero - 1, primeraEd.data ?? fiTemporada(primeraEd.temporada), primeraEd.temporada, null, "Arxiu: estat anterior al primer campionat de l'arxiu, del full de l'AJUSC."))
  w(valors(primeraEd.numero - 1, primeraEd.anterior))

  for (const e of edicions) {
    const data = e.data ?? fiTemporada(e.temporada)
    const participants = new Map(netes(e.nova).map((f) => [id(f.nom), f]))
    const abans = new Map(netes(e.anterior).map((f) => [id(f.nom), f]))
    const estat = new Map(netes(e.anterior).map((f) => [id(f.nom), aEstat(f)]))
    const variacions = calculaCampionat(e.c.entrada, estat)

    w(`-- =============================================================================
-- Edició ${e.numero}: ${e.campionat}  (${e.comprovacio.ok}/${e.comprovacio.de} participants quadren amb el full)
-- =============================================================================
INSERT INTO campionats (nom, data, temporada_codi, computa_barruf, finalitzat, rondes_jugades, ordre, origen, notes, primera_edicio)
VALUES (${q(e.campionat)}, DATE '${data}', ${q(e.temporada)}, TRUE, TRUE, ${new Set(e.c.partides.map((p: any) => p.ronda)).size}, ${e.numero}, 'arxiu AJUSC',
        ${q(`Importat de ${e.fitxer} (${e.variant}). El motor reprodueix ${e.comprovacio.ok} dels ${e.comprovacio.de} participants.${e.variant === 'aparellaments' ? ' Només se\'n conserven els aparellaments i les victòries totals.' : ''}${e.data ? '' : ' Sense data al full.'}`)}, ${e.numero});
`)
    w(`INSERT INTO inscripcions (campionat_id, jugador_id, victories)
SELECT c.id, n.jugador_id, i.v::numeric
FROM (VALUES ${e.c.entrada.inscrits.map((j: string) => `(${q(j)}, ${q(e.c.entrada.victories?.[j] ?? null)})`).join(', ')}) AS i(norm, v)
JOIN noms_arxiu n ON n.nom_norm = i.norm
CROSS JOIN (SELECT id FROM campionats WHERE primera_edicio = ${e.numero}) c
ON CONFLICT DO NOTHING;
`)
    if (e.c.partides.length) {
      w(`INSERT INTO partides (campionat_id, ronda, jugador_1_id, jugador_2_id, resultat_1, punts_1, punts_2)
SELECT c.id, p.ronda, n1.jugador_id, n2.jugador_id, p.resultat::numeric, p.p1::integer, p.p2::integer
FROM (VALUES
${e.c.partides.map((p: any) => `    (${p.ronda}, ${q(p.j1)}, ${q(p.j2)}, ${q(p.resultat)}, ${q(p.p1 === null ? null : Math.round(p.p1))}, ${q(p.p2 === null ? null : Math.round(p.p2))})`).join(',\n')}
) AS p(ronda, j1, j2, resultat, p1, p2)
JOIN noms_arxiu n1 ON n1.nom_norm = p.j1
LEFT JOIN noms_arxiu n2 ON n2.nom_norm = p.j2
CROSS JOIN (SELECT id FROM campionats WHERE primera_edicio = ${e.numero}) c;
`)
    }
    // Variacions: abans i després, els oficials; esperança i K, del motor.
    const vars = variacions.filter((v) => abans.has(v.jugadorId) || participants.has(v.jugadorId))
    if (vars.length) {
      w(`INSERT INTO barruf_variacions (campionat_id, jugador_id, barruf_abans, partides, victories, esperanca, factor_k, variacio, barruf_despres)
SELECT c.id, n.jugador_id, v.abans, v.partides, v.victories, v.esperanca, v.k, v.despres - v.abans, v.despres
FROM (VALUES
${vars.map((v) => {
  const a = abans.get(v.jugadorId)?.barruf ?? v.barrufAbans
  const d = participants.get(v.jugadorId)?.barruf ?? v.barrufDespres
  return `    (${q(v.jugadorId)}, ${Number(a.toFixed(4))}, ${v.partides}, ${v.victories}, ${v.esperanca.toFixed(6)}, ${v.factorK}, ${Number(d.toFixed(4))})`
}).join(',\n')}
) AS v(norm, abans, partides, victories, esperanca, k, despres)
JOIN noms_arxiu n ON n.nom_norm = v.norm
CROSS JOIN (SELECT id FROM campionats WHERE primera_edicio = ${e.numero}) c
ON CONFLICT DO NOTHING;
`)
    }
    if (e.numero < llavor) {
      w(edicio(e.numero, data, e.temporada, e.campionat, e.novaCalculada === 'pdf' ? "Arxiu: el full d'aquesta edició ha arribat trencat; els valors són els del PDF publicat." : e.novaCalculada ? "Arxiu: el full d'aquesta edició ha arribat trencat; els valors els ha calculat el motor i encadenen exactament amb la llavor." : "Arxiu: valors publicats al full de l'AJUSC."))
      w(valors(e.numero, e.nova))
    }
  }

  w('COMMIT;')
  return l.join('\n') + '\n'
}

main().catch((error) => {
  avis(`\n${(error as Error).message}`)
  process.exit(1)
})
