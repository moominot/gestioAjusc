/**
 * Prediccions entre jugadors amb la fórmula del BARRUF.
 *
 * La probabilitat que A guanyi B és l'esperança d'una partida del motor,
 * Φ((BARRUF A − BARRUF B) / σ), i el que es guanya o es perd és
 * (resultat − esperança) × K. Res d'això és nou: és com el BARRUF ja valora
 * cada partida, aplicat a partides que encara no s'han jugat.
 */

import { BARRUF_INICIAL } from '../barruf/constants'
import { arrodoneix, esperancaPartida, factorK } from '../barruf/motor'

export interface Contendent {
  numero: number
  barruf: number | null
  partidesTotals: number | null
}

/** El BARRUF amb què es calcula: arrodonit, i el de sortida per a qui no en té. */
export const barrufDe = (j: Contendent) => (j.barruf ? arrodoneix(j.barruf) : BARRUF_INICIAL)

/** Probabilitat que `a` guanyi `b` en una partida. */
export const probabilitat = (a: Contendent, b: Contendent) => esperancaPartida(barrufDe(a), barrufDe(b))

/** Què li passaria al BARRUF de `a` en una partida contra `b`, segons el resultat. */
export function efecte(a: Contendent, b: Contendent) {
  const e = probabilitat(a, b)
  const k = factorK(a.partidesTotals ?? 0, 1)
  return {
    guanya: arrodoneix((1 - e) * k),
    empata: arrodoneix((0.5 - e) * k),
    perd: arrodoneix((0 - e) * k),
  }
}

/** Generador pseudoaleatori amb llavor: la mateixa simulació dona sempre el mateix. */
function mulberry32(llavor: number) {
  let t = llavor >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export interface ResultatTorneig {
  numero: number
  /** Victòries esperades jugant una partida contra cada un dels altres. */
  esperades: number
  /** Probabilitat d'acabar primer (els empats al capdamunt es reparteixen). */
  primer: number
}

/**
 * Un torneig tots contra tots (una partida per parella) simulat moltes
 * vegades. Les victòries esperades són exactes; la probabilitat de quedar
 * primer surt de la simulació.
 */
export function torneig(jugadors: Contendent[], simulacions = 10000, llavor = 2026): ResultatTorneig[] {
  const n = jugadors.length
  const p = jugadors.map((a) => jugadors.map((b) => (a === b ? 0 : probabilitat(a, b))))
  const primer = new Array<number>(n).fill(0)
  const atzar = mulberry32(llavor)

  for (let s = 0; s < simulacions; s++) {
    const victories = new Array<number>(n).fill(0)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (atzar() < p[i][j]) victories[i]++
        else victories[j]++
      }
    }
    const max = Math.max(...victories)
    const guanyadors = victories.flatMap((v, i) => (v === max ? [i] : []))
    for (const g of guanyadors) primer[g] += 1 / guanyadors.length
  }

  return jugadors.map((j, i) => ({
    numero: j.numero,
    esperades: p[i].reduce((s, x) => s + x, 0),
    primer: primer[i] / simulacions,
  }))
}
