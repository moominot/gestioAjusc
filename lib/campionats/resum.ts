/**
 * Estadístiques d'una llista de campionats: la que queda després de filtrar.
 * Sense maquetació, perquè es pugui provar.
 */

export interface CampionatResum {
  id: string
  nom: string
  temporada_codi: string
  club_organitzador: string | null
  organitzador: string | null
  participants: number
  partides: number
  rondes_jugades: number | null
}

export interface Destacat {
  id?: string
  numero?: number
  nom: string
  valor: number
}

export interface Resum {
  campionats: number
  partides: number
  /** Suma de participants: un jugador compta una vegada per campionat. */
  participacions: number
  /** Persones diferents, si se sap qui ha jugat cada campionat. */
  jugadors: number | null
  mitjanaJugadors: number
  mitjanaPartides: number
  mesJugadors: Destacat | null
  mesPartides: Destacat | null
  mesRondes: Destacat | null
  organitzador: Destacat | null
  temporada: Destacat | null
  jugadorMesCampionats: Destacat | null
}

/** El primer segons una clau; en empat, el primer de la llista. */
function maxim<T>(llista: T[], clau: (x: T) => number): T | null {
  let millor: T | null = null
  for (const x of llista) if (millor === null || clau(x) > clau(millor)) millor = x
  return millor
}

function mesFrequent(valors: string[]): Destacat | null {
  const comptes = new Map<string, number>()
  for (const v of valors) comptes.set(v, (comptes.get(v) ?? 0) + 1)
  const [nom, valor] = maxim([...comptes], ([, n]) => n) ?? []
  return nom === undefined ? null : { nom, valor: valor! }
}

export function resumeix(
  campionats: CampionatResum[],
  jugadorsPer?: Record<string, number[]>,
  noms?: Record<string, string>,
): Resum {
  const n = campionats.length
  const partides = campionats.reduce((s, c) => s + c.partides, 0)
  const participacions = campionats.reduce((s, c) => s + c.participants, 0)

  let jugadors: number | null = null
  let jugadorMesCampionats: Destacat | null = null
  if (jugadorsPer) {
    const vegades = new Map<number, number>()
    for (const c of campionats) {
      for (const j of jugadorsPer[c.id] ?? []) vegades.set(j, (vegades.get(j) ?? 0) + 1)
    }
    jugadors = vegades.size
    const top = maxim([...vegades].sort((a, b) => a[0] - b[0]), ([, v]) => v)
    if (top) {
      jugadorMesCampionats = { numero: top[0], nom: noms?.[top[0]] ?? `núm. ${top[0]}`, valor: top[1] }
    }
  }

  const destaca = (c: CampionatResum | null, valor: (c: CampionatResum) => number | null): Destacat | null =>
    c && (valor(c) ?? 0) > 0 ? { id: c.id, nom: c.nom, valor: valor(c)! } : null

  const temporades = new Set(campionats.map((c) => c.temporada_codi))

  return {
    campionats: n,
    partides,
    participacions,
    jugadors,
    mitjanaJugadors: n ? participacions / n : 0,
    mitjanaPartides: n ? partides / n : 0,
    mesJugadors: destaca(maxim(campionats, (c) => c.participants), (c) => c.participants),
    mesPartides: destaca(maxim(campionats, (c) => c.partides), (c) => c.partides),
    mesRondes: destaca(maxim(campionats, (c) => c.rondes_jugades ?? 0), (c) => c.rondes_jugades),
    organitzador: mesFrequent(
      campionats.map((c) => c.club_organitzador ?? c.organitzador).filter((o): o is string => !!o),
    ),
    // Només té sentit si la llista abasta més d'una temporada.
    temporada: temporades.size > 1 ? mesFrequent(campionats.map((c) => c.temporada_codi)) : null,
    jugadorMesCampionats,
  }
}
