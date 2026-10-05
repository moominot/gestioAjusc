/**
 * El llibre de càlcul d'un campionat: dades generals, partides i el BARRUF
 * final per estats. Només construeix les pestanyes; qui el crida les escriu.
 */

import { categoria } from '../informe/model'
import type { FilaCrua } from '../informe/model'
import type { FitxaCampionat, PartidaCampionat } from './fitxa'

export type Cel = string | number | null
export interface Pestanya {
  nom: string
  /** La primera fila és la capçalera. */
  files: Cel[][]
  amples: number[]
}

/** Una fila de `informe_barruf()`: el BARRUF d'una edició. */
export type FilaBarruf = FilaCrua

export const ESTATS_BARRUF = [
  { clau: 'act', nom: 'BARRUF actius' },
  { clau: 'exp', nom: 'BARRUF en espera' },
  { clau: 'inact', nom: 'BARRUF inactius' },
  { clau: 'nov', nom: 'BARRUF novells' },
] as const

const valor = (v: unknown): Cel => {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' || typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  return JSON.stringify(v)
}

export function pestanyaGeneral(
  fitxa: FitxaCampionat,
  dades: Record<string, unknown> | null,
): Pestanya {
  const c = fitxa.campionat
  const files: Cel[][] = [
    ['Dada', 'Valor'],
    ['Nom', c.nom],
    ['Data', c.data],
    ['Temporada', c.temporada],
    ['Club organitzador', c.club_organitzador],
    ['Organitzador', c.organitzador],
    ['Participants', fitxa.jugadors.length],
    ['Partides', fitxa.partides.filter((p) => p.numero_2 !== null).length],
    ['Rondes jugades', c.rondes_jugades],
    ['Rondes previstes', c.rondes_previstes],
    ['Computa per al BARRUF', c.computa_barruf ? 'Sí' : 'No'],
    ['Finalitzat', c.finalitzat ? 'Sí' : 'No'],
    ['Edició BARRUF en què es va computar', c.primera_edicio],
    ...Object.entries(dades ?? {}).map(([clau, v]): Cel[] => [clau, valor(v)]),
  ]
  return { nom: 'Campionat', files, amples: [36, 50] }
}

const CAPCALERA_PARTIDES = [
  'Ronda',
  'Núm. 1',
  'Jugador 1',
  'Núm. 2',
  'Jugador 2',
  'Resultat 1',
  'Punts 1',
  'Punts 2',
  'Scrabbles 1',
  'Mot 1',
  'Punts mot 1',
  'Mot lletra 1',
  'Punts lletra 1',
  'Scrabbles 2',
  'Mot 2',
  'Punts mot 2',
  'Mot lletra 2',
  'Punts lletra 2',
]

export function pestanyaPartides(partides: PartidaCampionat[]): Pestanya {
  const ordenades = [...partides].sort((a, b) => a.ronda - b.ronda)
  // Totes les claus de dades lliures, en ordre d'aparició.
  const lliures: string[] = []
  for (const p of ordenades) {
    for (const clau of Object.keys(p.dades ?? {})) if (!lliures.includes(clau)) lliures.push(clau)
  }
  const files: Cel[][] = [[...CAPCALERA_PARTIDES, ...lliures]]
  for (const p of ordenades) {
    files.push([
      p.ronda,
      p.numero_1,
      p.jugador_1,
      p.numero_2,
      p.jugador_2 ?? (p.numero_2 === null ? 'descansa' : null),
      p.resultat_1 === null ? null : Number(p.resultat_1),
      p.punts_1,
      p.punts_2,
      valor(p.scrabbles_1),
      valor(p.mot_1),
      valor(p.punts_mot_1),
      valor(p.mot_lletra_1),
      valor(p.punts_lletra_1),
      valor(p.scrabbles_2),
      valor(p.mot_2),
      valor(p.punts_mot_2),
      valor(p.mot_lletra_2),
      valor(p.punts_lletra_2),
      ...lliures.map((clau) => valor(p.dades?.[clau])),
    ])
  }
  return {
    nom: 'Partides',
    files,
    amples: [8, 8, 28, 8, 28, 11, 9, 9, 11, 14, 11, 14, 13, 11, 14, 11, 14, 13, ...lliures.map(() => 18)],
  }
}

export function pestanyaBarruf(nom: string, files: FilaBarruf[]): Pestanya {
  const ordenades = [...files].sort((x, y) => y.barruf - x.barruf || x.ordre - y.ordre)
  return {
    nom,
    files: [
      [
        'Posició',
        'Núm.',
        'Jugador',
        'Club',
        'BARRUF',
        'Categoria',
        'Partides',
        'Victòries',
        'Partides temporada',
        'Victòries temporada',
        'Posició anterior',
        'BARRUF anterior',
      ],
      ...ordenades.map((f): Cel[] => [
        f.posicio,
        f.numero,
        f.nom,
        f.club,
        f.barruf,
        categoria(f.barruf),
        f.partides_totals,
        f.victories_totals,
        f.partides_temporada,
        f.victories_temporada,
        f.anterior?.posicio ?? null,
        f.anterior?.barruf ?? null,
      ]),
    ],
    amples: [9, 8, 30, 22, 10, 10, 10, 10, 12, 12, 12, 12],
  }
}

/** Les pestanyes del llibre, en ordre. El BARRUF és el d'`edicio`, amb el número al nom. */
export function pestanyesCampionat(
  fitxa: FitxaCampionat,
  dadesCampionat: Record<string, unknown> | null,
  barruf: FilaBarruf[],
  edicio: number | null = null,
): Pestanya[] {
  const sufix = edicio === null ? '' : ` ${edicio}`
  return [
    pestanyaGeneral(fitxa, dadesCampionat),
    pestanyaPartides(fitxa.partides),
    ...ESTATS_BARRUF.map((e) =>
      pestanyaBarruf(`${e.nom}${sufix}`, barruf.filter((f) => f.estat === e.clau)),
    ),
  ]
}
