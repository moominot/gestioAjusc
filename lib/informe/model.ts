/**
 * Model del PDF del BARRUF.
 *
 * Converteix el que retorna `informe_barruf()` en les files que es pinten, amb
 * les mateixes regles que el full de l'AJUSC (pestanyes `9Barruf` i
 * `9BarrufNoActius`). Aquí no hi ha res de maquetació: és on es decideix què
 * diu cada cel·la i de quin color va, i per això és el que es prova.
 */

import { arrodoneix } from '../barruf/motor'
import { BARRUF_INICIAL } from '../barruf/constants'

// --- El que arriba de la base de dades ----------------------------------------

export interface ValorsAnteriors {
  barruf: number
  estat: string
  posicio: number | null
  partides_totals: number
  victories_totals: number
}

export interface FilaCrua {
  numero: number
  nom: string
  club: string | null
  ordre: number
  barruf: number
  estat: 'nov' | 'exp' | 'act' | 'inact'
  posicio: number | null
  debutant: boolean
  partides_totals: number
  victories_totals: number
  partides_temporada: number
  victories_temporada: number
  anterior: ValorsAnteriors | null
}

export interface InformeCru {
  edicio: {
    numero: number
    data_publicacio: string
    temporada: string
    campionats_computats: string | null
    resultats_acumulats: number | null
    campionats_acumulats: number | null
  }
  anterior: number | null
  files: FilaCrua[]
  clubs: { nom: string; nom_llegenda: string }[]
  /** Només a l'especial de temporada: campionats barrufats a la temporada. */
  campionats_temporada?: number
}

// --- El que es pinta ----------------------------------------------------------

/** Els colors del full. */
export const COLOR = {
  verd: '#38761D',
  vermell: '#990000',
  negre: '#000000',
  categoria: ['#F1C232', '#000000', '#FF0000', '#0000FF', '#38761D'],
} as const

export interface Cella {
  text: string
  color?: string
}

export interface Fila {
  /** Posició, o `exp` / `inact` a la llista d'espera. */
  p: string
  /** Buit a la llista d'espera, que no porta aquesta columna. */
  var: Cella
  /** 1 a 5 (❶ a ❺), o `null` per sota de 1000. */
  categoria: number | null
  club: string
  nom: string
  barruf: string
  prg: Cella
  vb: Cella
  pjb: string
  percentTemp: Cella
  vtemp: string
  ptemp: string
  percentTotal: Cella
  vt: Cella
  dt: Cella
  pt: string
}

export interface Informe {
  numero: number
  temporada: string
  /** «setembre 2026» */
  mes: string
  campionatsComputats: string | null
  resultatsAcumulats: number | null
  campionatsAcumulats: number | null
  actius: Fila[]
  espera: Fila[]
  clubs: { nom: string; nomLlegenda: string }[]
  /**
   * Si no és una edició normal sinó una comparativa: amb quina edició es
   * compara i si és l'especial de final de temporada.
   */
  especial: { anterior: number; temporada: boolean } | null
}

// --- Format ---------------------------------------------------------------------

const MESOS = [
  'gener', 'febrer', 'març', 'abril', 'maig', 'juny',
  'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre',
]

export function mesIAny(data: string): string {
  const [any, mes] = data.split('-').map(Number)
  return `${MESOS[mes - 1]} ${any}`
}

/** 36 → «36,0»; les victòries van sempre amb un decimal i coma. */
const decimal = (valor: number) => valor.toFixed(1).replace('.', ',')

/** Amb signe si és positiu: «+7,0», «0,0». */
const decimalAmbSigne = (valor: number) => (valor > 0 ? '+' : '') + decimal(valor)

const enterAmbSigne = (valor: number) => (valor > 0 ? `+${valor}` : String(valor))

/**
 * Percentatge sense decimals. El `toFixed` previ evita que un 74,5 que la coma
 * flotant guarda com 74,4999… s'arrodoneixi cap avall.
 */
const percent = (fraccio: number) => `${arrodoneix(Number((fraccio * 100).toFixed(9)))}%`

/** Categoria segons el BARRUF arrodonit, com fa el full. */
export function categoria(barruf: number): number | null {
  const b = arrodoneix(barruf)
  if (b >= 1400) return 1
  if (b >= 1300) return 2
  if (b >= 1200) return 3
  if (b >= 1100) return 4
  if (b >= 1000) return 5
  return null
}

/**
 * Color d'un percentatge de victòries. Per damunt del 50% verd, del 10% al 50%
 * vermell. Per sota del 10% el full no té cap regla i la cel·la pren el color
 * de la columna, que no és el mateix a totes: d'aquí que alguns 0% surtin en
 * verd. Es reprodueix tal qual perquè el PDF quadri amb el publicat.
 */
function colorPercent(fraccio: number, perDefecte: string): string {
  if (fraccio >= 0.5) return COLOR.verd
  if (fraccio >= 0.1) return COLOR.vermell
  return perDefecte
}

const colorSigne = (valor: number): string | undefined =>
  valor > 0 ? COLOR.verd : valor < 0 ? COLOR.vermell : undefined

// --- Files ----------------------------------------------------------------------

/**
 * Els valors de cada fila que no depenen de la llista on va.
 *
 * La progressió, les victòries i les partides «des de l'anterior BARRUF" surten
 * de comparar amb l'edició anterior. El full les treu del campionat computat,
 * però és el mateix: tot el que s'acumula entre dues edicions és d'aquell
 * campionat. Un jugador nou es compara amb el BARRUF de sortida.
 */
function comuns(f: FilaCrua) {
  const barruf = arrodoneix(f.barruf)
  const barrufAnterior = f.anterior ? arrodoneix(f.anterior.barruf) : BARRUF_INICIAL
  const prg = barruf - barrufAnterior
  const vb = f.victories_totals - (f.anterior?.victories_totals ?? 0)
  const pjb = f.partides_totals - (f.anterior?.partides_totals ?? 0)
  const pctTemp = f.partides_temporada ? f.victories_temporada / f.partides_temporada : 0
  const pctTotal = f.partides_totals ? f.victories_totals / f.partides_totals : 0
  const dt = f.partides_totals - f.victories_totals

  return { barruf, prg, vb, pjb, pctTemp, pctTotal, dt }
}

/**
 * Variació de posició: `deb` si debuta aquesta temporada, `rec` si abans no
 * tenia posició (tornava de la llista d'espera), i si no, quants llocs ha pujat.
 */
function variacioPosicio(f: FilaCrua): Cella {
  if (f.debutant) return { text: 'deb' }
  const abans = f.anterior?.posicio ?? null
  if (abans === null) return { text: 'rec' }
  const salt = abans - (f.posicio ?? abans)
  if (salt === 0) return { text: '=' }
  return { text: enterAmbSigne(salt), color: salt < 0 ? COLOR.vermell : undefined }
}

function filaActiu(f: FilaCrua): Fila {
  const c = comuns(f)
  return {
    p: String(f.posicio),
    var: variacioPosicio(f),
    categoria: categoria(f.barruf),
    club: f.club ?? '',
    nom: f.nom,
    barruf: String(c.barruf),
    prg: { text: enterAmbSigne(c.prg), color: colorSigne(c.prg) },
    vb: { text: decimalAmbSigne(c.vb), color: c.vb > 0 ? COLOR.verd : undefined },
    pjb: enterAmbSigne(c.pjb),
    percentTemp: { text: percent(c.pctTemp), color: colorPercent(c.pctTemp, COLOR.negre) },
    vtemp: decimal(f.victories_temporada),
    ptemp: String(f.partides_temporada),
    // A la llista d'actius, les columnes del total tenen color de base: el %T
    // i les victòries en verd, les derrotes en vermell.
    percentTotal: { text: percent(c.pctTotal), color: colorPercent(c.pctTotal, COLOR.verd) },
    vt: { text: decimal(f.victories_totals), color: COLOR.verd },
    dt: { text: decimal(c.dt), color: COLOR.vermell },
    pt: String(f.partides_totals),
  }
}

function filaEspera(f: FilaCrua): Fila {
  const c = comuns(f)
  return {
    p: f.estat,
    var: { text: '' },
    categoria: categoria(f.barruf),
    club: f.club ?? '',
    nom: f.nom,
    barruf: String(c.barruf),
    prg: { text: enterAmbSigne(c.prg), color: colorSigne(c.prg) },
    // Aquí el full pinta les victòries en verd si el BARRUF s'ha mogut.
    vb: { text: decimalAmbSigne(c.vb), color: c.prg !== 0 ? COLOR.verd : undefined },
    pjb: enterAmbSigne(c.pjb),
    percentTemp: { text: percent(c.pctTemp), color: colorPercent(c.pctTemp, COLOR.negre) },
    vtemp: decimal(f.victories_temporada),
    ptemp: String(f.partides_temporada),
    // I aquí les columnes no tenen color de base: un zero surt en negre.
    percentTotal: { text: percent(c.pctTotal), color: colorPercent(c.pctTotal, COLOR.negre) },
    vt: { text: decimal(f.victories_totals), color: f.victories_totals > 0 ? COLOR.verd : undefined },
    dt: { text: decimal(c.dt), color: c.dt > 0 ? COLOR.vermell : undefined },
    pt: String(f.partides_totals),
  }
}

/** Per BARRUF i, en cas d'empat, en l'ordre de la llista del full. */
const perBarruf = (a: FilaCrua, b: FilaCrua) => b.barruf - a.barruf || a.ordre - b.ordre

/** Ordre de la llegenda: alfabètic sense l'article («el Prat» va a la P). */
const clauClub = (nom: string) =>
  nom
    .replace(/^(el |la |l')/i, '')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()

export function construeixInforme(
  cru: InformeCru,
  opcions: { especial?: 'temporada' | 'comparativa' } = {},
): Informe {
  const actius = cru.files.filter((f) => f.estat === 'act').sort(perBarruf)
  const espera = cru.files.filter((f) => f.estat === 'exp' || f.estat === 'inact').sort(perBarruf)

  return {
    numero: cru.edicio.numero,
    temporada: cru.edicio.temporada,
    mes: mesIAny(cru.edicio.data_publicacio),
    campionatsComputats: cru.edicio.campionats_computats,
    resultatsAcumulats: cru.edicio.resultats_acumulats,
    campionatsAcumulats: cru.edicio.campionats_acumulats,
    actius: actius.map(filaActiu),
    espera: espera.map(filaEspera),
    clubs: cru.clubs
      .map((c) => ({ nom: c.nom, nomLlegenda: c.nom_llegenda }))
      .sort((a, b) => clauClub(a.nom).localeCompare(clauClub(b.nom), 'ca')),
    especial:
      opcions.especial && cru.anterior !== null
        ? { anterior: cru.anterior, temporada: opcions.especial === 'temporada' }
        : null,
  }
}

/** «BARRUF-210 setembre 2026.pdf», com els anomena el full. */
export function nomFitxer(informe: Pick<Informe, 'numero' | 'mes'> & Partial<Pick<Informe, 'temporada' | 'especial'>>): string {
  if (informe.especial?.temporada) return `BARRUF ESPECIAL TEMPORADA ${informe.temporada}.pdf`
  if (informe.especial) return `BARRUF-${informe.especial.anterior} a ${informe.numero}.pdf`
  return `BARRUF-${informe.numero} ${informe.mes}.pdf`
}

/** «de setembre 2026», però «d’agost 2018» i «d’octubre 2019». */
export function deMes(mes: string): string {
  return /^[aeiouàèéíòóú]/i.test(mes) ? `d’${mes}` : `de ${mes}`
}
