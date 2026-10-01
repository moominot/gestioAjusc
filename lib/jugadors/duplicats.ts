/**
 * Detecció de jugadors que potser són la mateixa persona amb dues fitxes.
 *
 * Només proposa: la decisió és d'un gestor. Els criteris són de nom, i un de
 * descart que és definitiu: dues fitxes que han coincidit en un mateix
 * campionat són dues persones, per molt que s'assemblin els noms.
 */

import { normalitzaNom } from '../importacio/noms'
import { cognomsComuns, semblanca } from '../importacio/resolucio'

export interface JugadorDades {
  numero: number
  nom: string
  club: string | null
  partides: number
  /** Primera i darrera temporada amb algun campionat, o null si no en té cap. */
  primera: string | null
  darrera: string | null
  campionats: string[]
}

export type Motiu =
  | 'mateix nom'
  | 'noms semblants'
  | 'un nom dins l’altre'
  | 'inicials'
  | 'mateixos cognoms'
  | 'mateix cognom'

export interface ParellaCandidata {
  a: JugadorDades
  b: JugadorDades
  motius: Motiu[]
  /** Semblança dels noms, de 0 a 1. */
  semblanca: number
  /** Les temporades de l'un i de l'altre no es trepitgen: un plega i l'altre comença. */
  periodesSeparats: boolean
  puntuacio: number
}

/** Llindar de semblança (Levenshtein) a partir del qual dos noms es proposen. */
export const LLINDAR_SEMBLANCA = 0.8

const paraules = (nom: string) => normalitzaNom(nom).replace(/\./g, ' ').split(' ').filter(Boolean)

/** «r» casa amb «ramon»; una paraula sencera, només amb ella mateixa. */
const casa = (curta: string, llarga: string) =>
  curta === llarga || (curta.length === 1 && llarga.startsWith(curta))

/** Totes les paraules d'un nom són a l'altre (en ordre), i en comparteixen almenys dues de senceres. */
function contingut(a: string[], b: string[]): { contingut: boolean; inicials: boolean } {
  const [curt, llarg] = a.length <= b.length ? [a, b] : [b, a]
  let j = 0
  let senceres = 0
  let inicials = false
  for (const p of curt) {
    while (j < llarg.length && !casa(p, llarg[j]) && !casa(llarg[j], p)) j++
    if (j === llarg.length) return { contingut: false, inicials: false }
    if (p === llarg[j]) senceres++
    else inicials = true
    j++
  }
  return { contingut: senceres >= 2, inicials: senceres >= 2 && inicials }
}

function periodesSeparats(a: JugadorDades, b: JugadorDades): boolean {
  if (!a.primera || !a.darrera || !b.primera || !b.darrera) return false
  return a.darrera < b.primera || b.darrera < a.primera
}

const clau = (x: number, y: number) => (x < y ? `${x}-${y}` : `${y}-${x}`)

/**
 * Parelles candidates, de més a menys probables.
 *
 * `descartades` són les parelles que un gestor ja ha dit que són dues persones.
 */
export function trobaDuplicats(
  jugadors: JugadorDades[],
  descartades: [number, number][] = [],
): ParellaCandidata[] {
  const fora = new Set(descartades.map(([x, y]) => clau(x, y)))
  const preparats = jugadors.map((j) => ({
    j,
    norm: normalitzaNom(j.nom),
    paraules: paraules(j.nom),
    campionats: new Set(j.campionats),
  }))

  const parelles: ParellaCandidata[] = []
  for (let i = 0; i < preparats.length; i++) {
    for (let k = i + 1; k < preparats.length; k++) {
      const x = preparats[i]
      const y = preparats[k]
      if (fora.has(clau(x.j.numero, y.j.numero))) continue

      const motius: Motiu[] = []
      let s = 0
      if (x.norm === y.norm) {
        motius.push('mateix nom')
        s = 1
      } else {
        // Levenshtein només si les longituds s'hi acosten: és el pas car.
        const llarg = Math.max(x.norm.length, y.norm.length)
        if (Math.abs(x.norm.length - y.norm.length) <= llarg * (1 - LLINDAR_SEMBLANCA)) {
          s = semblanca(x.norm, y.norm)
          if (s >= LLINDAR_SEMBLANCA) motius.push('noms semblants')
        }
        const c = contingut(x.paraules, y.paraules)
        if (c.inicials) motius.push('inicials')
        else if (c.contingut) motius.push('un nom dins l’altre')
        // Pels cognoms, des del final i per mots sencers. Amb un sol cognom en comú
        // n'hi ha massa (tots els Riera): cal que el nom comenci per la mateixa lletra.
        if (!c.contingut) {
          const comuns = cognomsComuns(x.norm, y.norm)
          if (comuns === 2) motius.push('mateixos cognoms')
          else if (comuns === 1 && x.norm[0] === y.norm[0]) motius.push('mateix cognom')
        }
      }
      if (motius.length === 0) continue

      // Si han coincidit en un campionat, són dues persones.
      const [menys, mes] = x.campionats.size <= y.campionats.size ? [x, y] : [y, x]
      let coincideixen = false
      for (const c of menys.campionats) {
        if (mes.campionats.has(c)) {
          coincideixen = true
          break
        }
      }
      if (coincideixen) continue

      const separats = periodesSeparats(x.j, y.j)
      const mateixClub = x.j.club !== null && x.j.club === y.j.club
      parelles.push({
        a: x.j.partides >= y.j.partides ? x.j : y.j,
        b: x.j.partides >= y.j.partides ? y.j : x.j,
        motius,
        semblanca: s,
        periodesSeparats: separats,
        puntuacio: Math.max(
          s,
          motius.includes('un nom dins l’altre') || motius.includes('inicials') ? 0.85 : 0,
          motius.includes('mateixos cognoms') ? 0.75 : motius.includes('mateix cognom') ? 0.6 : 0,
        ) +
          (separats ? 0.1 : 0) +
          (mateixClub ? 0.05 : 0),
      })
    }
  }
  return parelles.sort((p, q) => q.puntuacio - p.puntuacio || p.a.nom.localeCompare(q.a.nom, 'ca'))
}
