/**
 * La fitxa d'un campionat: el que retorna `fitxa_campionat()` i el que se'n
 * calcula per ensenyar-lo. Sense res de maquetació, perquè es pugui provar.
 */

export interface JugadorCampionat {
  numero: number
  nom: string
  club: string | null
  partides: number
  victories: number
  punts_favor: number | null
  punts_contra: number | null
  millor_puntuacio: number | null
  /** Scrabbles del campionat i millors jugades, si se'n tenen les dades. */
  scrabbles?: number | null
  mot?: string | null
  punts_mot?: number | null
  mot_lletra?: string | null
  punts_lletra?: number | null
  barruf_abans: number | null
  barruf_despres: number | null
  variacio: number | null
  esperanca: number | null
  factor_k: number | null
  posicio: number | null
  posicio_anterior: number | null
  estat: string | null
}

export interface PartidaCampionat {
  id: string
  ronda: number
  numero_1: number
  jugador_1: string
  numero_2: number | null
  jugador_2: string | null
  /** `null` si només se sap qui hi va jugar (campionats antics). */
  resultat_1: number | null
  punts_1: number | null
  punts_2: number | null
  scrabbles_1?: number | null
  scrabbles_2?: number | null
  mot_1?: string | null
  punts_mot_1?: number | null
  mot_lletra_1?: string | null
  punts_lletra_1?: number | null
  mot_2?: string | null
  punts_mot_2?: number | null
  mot_lletra_2?: string | null
  punts_lletra_2?: number | null
  /** Dades lliures (enllaç al full, taula, comentaris...). La fitxa no les porta: s'hi afegeixen a part. */
  dades?: Record<string, unknown> | null
}

export interface FitxaCampionat {
  campionat: {
    id: string
    nom: string
    data: string
    temporada: string
    organitzador: string | null
    club_organitzador: string | null
    computa_barruf: boolean
    finalitzat: boolean
    barrufat: boolean
    rondes_jugades: number | null
    rondes_previstes: number | null
    primera_edicio: number | null
  }
  jugadors: JugadorCampionat[]
  partides: PartidaCampionat[]
}

export interface FilaClassificacioCampionat extends JugadorCampionat {
  /** Posició al campionat: per victòries i, en empat, per diferència de punts. */
  lloc: number
  diferencia: number | null
}

/**
 * La classificació del campionat.
 *
 * Per victòries i, a igualtat, per la diferència de punts, que és com es
 * desempata a l'Scrabble. Qui té les mateixes victòries i la mateixa diferència
 * comparteix lloc.
 */
export function classificacio(jugadors: JugadorCampionat[]): FilaClassificacioCampionat[] {
  const files = jugadors.map((j) => ({
    ...j,
    victories: Number(j.victories),
    diferencia:
      j.punts_favor === null || j.punts_contra === null ? null : j.punts_favor - j.punts_contra,
    lloc: 0,
  }))
  files.sort(
    (a, b) =>
      b.victories - a.victories ||
      (b.diferencia ?? 0) - (a.diferencia ?? 0) ||
      a.nom.localeCompare(b.nom, 'ca'),
  )
  files.forEach((f, i) => {
    const anterior = files[i - 1]
    f.lloc =
      anterior && anterior.victories === f.victories && anterior.diferencia === f.diferencia
        ? anterior.lloc
        : i + 1
  })
  return files
}

export interface Estadistiques {
  participants: number
  partides: number
  rondes: number
  ambPunts: boolean
  mitjanaPartida: number | null
  millorPuntuacio: { punts: number; jugador: string; rival: string | null; ronda: number } | null
  majorVictoria: { diferencia: number; guanyador: string; perdedor: string; marcador: string } | null
  partidaMesAlta: { total: number; descripcio: string } | null
  mesPujada: { nom: string; variacio: number } | null
  /** Hi ha scrabbles o millors jugades d'alguna partida. */
  ambJugades: boolean
  millorJugada: JugadaDestacada | null
  millorLletra: JugadaDestacada | null
  mesScrabbles: { jugador: string; scrabbles: number } | null
}

export interface JugadaDestacada {
  mot?: string | null
  punts: number
  jugador: string
  ronda: number
}

/** La jugada de més punts d'entre les partides, mirant els dos costats. */
function millorDe(
  partides: PartidaCampionat[],
  jugada: (p: PartidaCampionat, costat: 1 | 2) => [string | null | undefined, number | null | undefined],
): JugadaDestacada | null {
  let millor: JugadaDestacada | null = null
  for (const p of partides) {
    for (const costat of [1, 2] as const) {
      const [mot, punts] = jugada(p, costat)
      if (punts === null || punts === undefined) continue
      if (!millor || punts > millor.punts) {
        millor = {
          mot: mot ?? null,
          punts,
          jugador: costat === 1 ? p.jugador_1 : (p.jugador_2 ?? ''),
          ronda: p.ronda,
        }
      }
    }
  }
  return millor
}

/** Les xifres del campionat que no surten directament de la base de dades. */
export function estadistiques(fitxa: FitxaCampionat): Estadistiques {
  const jugades = fitxa.partides.filter((p) => p.numero_2 !== null)
  const ambPunts = jugades.filter((p) => p.punts_1 !== null && p.punts_2 !== null)

  let millorPuntuacio: Estadistiques['millorPuntuacio'] = null
  let majorVictoria: Estadistiques['majorVictoria'] = null
  let partidaMesAlta: Estadistiques['partidaMesAlta'] = null
  for (const p of ambPunts) {
    const [a, b] = [p.punts_1!, p.punts_2!]
    for (const [punts, jugador, rival] of [
      [a, p.jugador_1, p.jugador_2],
      [b, p.jugador_2!, p.jugador_1],
    ] as const) {
      if (!millorPuntuacio || punts > millorPuntuacio.punts) {
        millorPuntuacio = { punts, jugador, rival, ronda: p.ronda }
      }
    }
    const diferencia = Math.abs(a - b)
    if (!majorVictoria || diferencia > majorVictoria.diferencia) {
      const primer = a >= b
      majorVictoria = {
        diferencia,
        guanyador: primer ? p.jugador_1 : p.jugador_2!,
        perdedor: primer ? p.jugador_2! : p.jugador_1,
        marcador: primer ? `${a}–${b}` : `${b}–${a}`,
      }
    }
    if (!partidaMesAlta || a + b > partidaMesAlta.total) {
      partidaMesAlta = { total: a + b, descripcio: `${p.jugador_1} ${a} – ${b} ${p.jugador_2}` }
    }
  }

  const ambVariacio = fitxa.jugadors.filter((j) => j.variacio !== null)
  const mesPujada = ambVariacio.reduce<Estadistiques['mesPujada']>(
    (millor, j) =>
      !millor || Number(j.variacio) > millor.variacio ? { nom: j.nom, variacio: Number(j.variacio) } : millor,
    null,
  )

  const millorJugada = millorDe(jugades, (p, c) =>
    c === 1 ? [p.mot_1, p.punts_mot_1] : [p.mot_2, p.punts_mot_2],
  )
  const millorLletra = millorDe(jugades, (p, c) =>
    c === 1 ? [p.mot_lletra_1, p.punts_lletra_1] : [p.mot_lletra_2, p.punts_lletra_2],
  )
  const mesScrabbles = fitxa.jugadors.reduce<Estadistiques['mesScrabbles']>(
    (millor, j) =>
      j.scrabbles !== null && j.scrabbles !== undefined && (!millor || j.scrabbles > millor.scrabbles)
        ? { jugador: j.nom, scrabbles: j.scrabbles }
        : millor,
    null,
  )

  return {
    participants: fitxa.jugadors.length,
    partides: jugades.length,
    rondes: new Set(fitxa.partides.map((p) => p.ronda)).size,
    ambPunts: ambPunts.length > 0,
    mitjanaPartida: ambPunts.length
      ? ambPunts.reduce((s, p) => s + p.punts_1! + p.punts_2!, 0) / (2 * ambPunts.length)
      : null,
    millorPuntuacio,
    majorVictoria,
    partidaMesAlta,
    mesPujada,
    ambJugades: millorJugada !== null || millorLletra !== null || mesScrabbles !== null,
    millorJugada,
    millorLletra,
    mesScrabbles,
  }
}

/** Les partides agrupades per ronda, en ordre. */
export function perRonda(partides: PartidaCampionat[]): [number, PartidaCampionat[]][] {
  const rondes = new Map<number, PartidaCampionat[]>()
  for (const p of partides) rondes.set(p.ronda, [...(rondes.get(p.ronda) ?? []), p])
  return [...rondes].sort((a, b) => a[0] - b[0])
}
