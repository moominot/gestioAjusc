/**
 * Les consultes de la secció d'estadístiques: què demanen a la base de dades
 * i com es mostren. La pàgina i el CSV en fan servir la mateixa definició.
 */

export interface Filtres {
  des_de?: string
  fins_a?: string
  club?: string
  campionat?: string
  jugador?: number
  minim?: number
}

export type Fila = Record<string, unknown>

export interface Columna {
  etiqueta: string
  /** El text de la cel·la (també el del CSV). */
  text: (f: Fila) => string
  /** Enllaç opcional de la cel·la. */
  enllac?: (f: Fila) => string | null
  dreta?: boolean
  /** Es pot amagar en pantalles estretes. */
  secundaria?: boolean
}

export interface Bloc {
  titol?: string
  metrica: string
  limit: number
  columnes: Columna[]
  /** El gràfic de barres: quin valor i quina etiqueta. */
  barres?: { valor: (f: Fila) => number; etiqueta: (f: Fila) => string; format?: (v: number) => string }
  /** Núvol de punts: x i y. */
  nuvol?: { x: (f: Fila) => number; y: (f: Fila) => number; etiquetaX: string; etiquetaY: string; formatY?: (v: number) => string }
}

export interface Consulta {
  slug: string
  titol: string
  descripcio: string
  /** Partides mínimes per defecte, si la consulta en fa servir. */
  minim?: number
  /** Sèrie per temporades, amb un gràfic de línies. */
  perTemporada?: boolean
  blocs: Bloc[]
}

const n = (v: unknown) => Number(v ?? 0)
const enter = (v: unknown) => (v === null || v === undefined ? '—' : n(v).toLocaleString('ca-ES'))
const dec = (v: unknown, d = 1) =>
  v === null || v === undefined ? '—' : n(v).toLocaleString('ca-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
const pct = (v: unknown) => (v === null || v === undefined ? '—' : `${dec(n(v) * 100)} %`)

const jugador: Columna = {
  etiqueta: 'Jugador',
  text: (f) => String(f.nom ?? ''),
  enllac: (f) => (f.numero ? `/jugadors/${f.numero}` : null),
}
const club: Columna = { etiqueta: 'Club', text: (f) => String(f.club ?? '—'), secundaria: true }
const campionat: Columna = {
  etiqueta: 'Campionat',
  text: (f) => String(f.campionat ?? ''),
  enllac: (f) => (f.campionat_id ? `/campionats/${f.campionat_id}` : null),
  secundaria: true,
}

export const CONSULTES: Consulta[] = [
  {
    slug: 'barruf',
    titol: 'BARRUF màxim',
    descripcio:
      'El BARRUF més alt que ha tingut cada jugador, amb l’edició on el va assolir i la millor posició. Només compten les edicions amb més de 10 partides, quan el BARRUF ja és ferm.',
    blocs: [
      {
        metrica: 'barruf_maxim',
        limit: 100,
        columnes: [
          jugador,
          club,
          { etiqueta: 'BARRUF màxim', text: (f) => enter(f.valor), dreta: true },
          { etiqueta: 'Edició', text: (f) => `${f.edicio} (${f.temporada})`, enllac: (f) => `/barruf/pdf?edicio=${f.edicio}`, secundaria: true },
          { etiqueta: 'Millor posició', text: (f) => (f.millor_posicio ? `${f.millor_posicio}a` : '—'), dreta: true },
          { etiqueta: 'Partides', text: (f) => enter(f.partides), dreta: true, secundaria: true },
        ],
        barres: { valor: (f) => n(f.valor), etiqueta: (f) => String(f.nom) },
      },
    ],
  },
  {
    slug: 'activitat',
    titol: 'Partides i activitat',
    descripcio:
      'Qui ha jugat més partides, en quants campionats i temporades, i com ha evolucionat la participació temporada a temporada.',
    perTemporada: true,
    blocs: [
      {
        metrica: 'partides',
        limit: 100,
        columnes: [
          jugador,
          club,
          { etiqueta: 'Partides', text: (f) => enter(f.partides), dreta: true },
          { etiqueta: 'Campionats', text: (f) => enter(f.campionats), dreta: true },
          { etiqueta: 'Temporades', text: (f) => enter(f.temporades), dreta: true, secundaria: true },
          { etiqueta: 'Punts per partida', text: (f) => enter(f.punts_mitjans), dreta: true, secundaria: true },
        ],
        barres: { valor: (f) => n(f.partides), etiqueta: (f) => String(f.nom) },
      },
    ],
  },
  {
    slug: 'victories',
    titol: 'Percentatge de victòries',
    descripcio:
      'Victòries sobre les partides amb resultat conegut (d’alguns campionats del 2014 al 2018 només se’n saben els aparellaments). Amb un mínim de partides perquè el percentatge digui alguna cosa.',
    minim: 50,
    blocs: [
      {
        metrica: 'victories',
        limit: 300,
        columnes: [
          jugador,
          club,
          { etiqueta: '% victòries', text: (f) => pct(f.valor), dreta: true },
          { etiqueta: 'Victòries', text: (f) => dec(f.victories), dreta: true, secundaria: true },
          { etiqueta: 'Partides', text: (f) => enter(f.amb_resultat), dreta: true },
          { etiqueta: 'Punts per partida', text: (f) => enter(f.punts_mitjans), dreta: true, secundaria: true },
        ],
        barres: { valor: (f) => n(f.valor) * 100, etiqueta: (f) => String(f.nom), format: (v) => `${dec(v)} %` },
        nuvol: {
          x: (f) => n(f.amb_resultat),
          y: (f) => n(f.valor) * 100,
          etiquetaX: 'partides',
          etiquetaY: '% victòries',
          formatY: (v) => `${Math.round(v)} %`,
        },
      },
    ],
  },
  {
    slug: 'jugades',
    titol: 'Jugades i scrabbles',
    descripcio:
      'Les millors jugades i els scrabbles registrats. Només els tenim d’una part dels campionats, sobretot de Mallorca: compten les partides que en tenen dades.',
    minim: 20,
    blocs: [
      {
        titol: 'Millors jugades',
        metrica: 'millors_jugades',
        limit: 50,
        columnes: [
          { etiqueta: 'Mot', text: (f) => String(f.mot ?? '—') },
          { etiqueta: 'Punts', text: (f) => enter(f.valor), dreta: true },
          jugador,
          { etiqueta: 'Rival', text: (f) => String(f.rival ?? ''), enllac: (f) => `/jugadors/${f.rival_numero}`, secundaria: true },
          campionat,
        ],
        barres: { valor: (f) => n(f.valor), etiqueta: (f) => `${f.mot ?? '—'} · ${f.nom}` },
      },
      {
        titol: 'Millors jugades amb lletra especial',
        metrica: 'millors_lletra',
        limit: 30,
        columnes: [
          { etiqueta: 'Mot', text: (f) => String(f.mot ?? '—') },
          { etiqueta: 'Punts', text: (f) => enter(f.valor), dreta: true },
          jugador,
          { etiqueta: 'Rival', text: (f) => String(f.rival ?? ''), enllac: (f) => `/jugadors/${f.rival_numero}`, secundaria: true },
          campionat,
        ],
      },
      {
        titol: 'Scrabbles',
        metrica: 'scrabbles',
        limit: 50,
        columnes: [
          jugador,
          club,
          { etiqueta: 'Scrabbles', text: (f) => enter(f.valor), dreta: true },
          { etiqueta: 'Per partida', text: (f) => dec(f.mitjana, 2), dreta: true },
          { etiqueta: 'Partides', text: (f) => enter(f.partides), dreta: true, secundaria: true },
          { etiqueta: 'Rècord', text: (f) => enter(f.record), dreta: true, secundaria: true },
        ],
        barres: { valor: (f) => n(f.valor), etiqueta: (f) => String(f.nom) },
      },
    ],
  },
  {
    slug: 'enfrontaments',
    titol: 'Enfrontaments',
    descripcio:
      'Les parelles que més vegades s’han enfrontat, amb el balanç. Filtreu per un jugador per veure tots els seus rivals.',
    minim: 5,
    blocs: [
      {
        metrica: 'enfrontaments',
        limit: 100,
        columnes: [
          jugador,
          { etiqueta: 'Rival', text: (f) => String(f.rival ?? ''), enllac: (f) => `/jugadors/${f.rival_numero}` },
          { etiqueta: 'Partides', text: (f) => enter(f.valor), dreta: true },
          {
            etiqueta: 'Balanç',
            text: (f) => (n(f.amb_resultat) ? `${dec(f.victories)} – ${dec(n(f.amb_resultat) - n(f.victories))}` : '—'),
            dreta: true,
          },
          { etiqueta: 'Campionats', text: (f) => enter(f.campionats), dreta: true, secundaria: true },
          {
            etiqueta: 'Comparar',
            text: () => 'comparar',
            enllac: (f) => `/comparar?j=${f.numero},${f.rival_numero}`,
            secundaria: true,
          },
        ],
        barres: { valor: (f) => n(f.valor), etiqueta: (f) => `${f.nom} – ${f.rival}` },
      },
    ],
  },
]

export const consulta = (slug: string) => CONSULTES.find((c) => c.slug === slug) ?? null

/** Els filtres que porta l'adreça. */
export function llegeixFiltres(p: Record<string, string | string[] | undefined>, perDefecte?: number): Filtres {
  const u = (k: string) => (typeof p[k] === 'string' && p[k] ? (p[k] as string) : undefined)
  const temporada = (v?: string) => (v && /^\d{4}-\d{2}$/.test(v) ? v : undefined)
  const enterPositiu = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined)
  return {
    des_de: temporada(u('des_de')),
    fins_a: temporada(u('fins_a')),
    club: u('club'),
    campionat: u('campionat') && /^[0-9a-f-]{36}$/i.test(u('campionat')!) ? u('campionat') : undefined,
    jugador: enterPositiu(u('jugador')),
    minim: enterPositiu(u('minim')) ?? perDefecte,
  }
}

/** Els filtres com els vol la base de dades: sense els buits. */
export const perBaseDeDades = (f: Filtres) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))

/** Una taula en CSV, separada per punts i comes (com l'obre l'Excel en català). */
export function csv(columnes: Columna[], files: Fila[]): string {
  const cel = (t: string) => (/[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t)
  return [columnes.map((c) => cel(c.etiqueta)).join(';'), ...files.map((f) => columnes.map((c) => cel(c.text(f))).join(';'))].join('\n')
}
