/** Estat d'un jugador dins del BARRUF. Es deriva, no s'emmagatzema com a veritat. */
export type EstatJugador = 'nov' | 'exp' | 'act' | 'inact'

/** Resultat d'una partida des del punt de vista d'un jugador. */
export type Resultat = 0 | 0.5 | 1

/** Estat acumulat d'un jugador en un punt qualsevol de la cadena. */
export interface EstatBarruf {
  jugadorId: string
  barruf: number
  partidesTotals: number
  victoriesTotals: number
  partidesTemporada: number
  victoriesTemporada: number
  /** Codi de la darrera temporada en què va jugar. `null` si no ha jugat mai. */
  darreraTemporada: string | null
}

/** Una partida ja resolta a identificadors de jugador. */
export interface PartidaResolta {
  ronda: number
  jugador1Id: string
  /** `null` vol dir BYE: no compta per al BARRUF. */
  jugador2Id: string | null
  resultat1: Resultat
}

/** Un campionat a punt de ser processat per la cadena. */
export interface CampionatEntrada {
  id: string
  /** Jugadors inscrits, hagin jugat o no. */
  inscrits: string[]
  partides: PartidaResolta[]
  temporadaCodi: string
}

/** Detall auditable de la variació d'un jugador en un campionat. */
export interface VariacioBarruf {
  jugadorId: string
  barrufAbans: number
  partides: number
  victories: number
  esperanca: number
  factorK: number
  variacio: number
  barrufDespres: number
}
