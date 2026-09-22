/**
 * Tipus del model de lectura.
 *
 * Es corresponen amb les vistes de `supabase/migrations/20260922100300_vistes_publiques.sql`.
 * Les xifres arriben com a text perquè PostgreSQL retorna els NUMERIC així per
 * no perdre precisió; es converteixen on es mostren.
 */

export type EstatJugador = 'nov' | 'exp' | 'act' | 'inact'

export const ETIQUETA_ESTAT: Record<EstatJugador, string> = {
  nov: 'Novell',
  exp: 'Expectativa',
  act: 'Actiu',
  inact: 'Inactiu',
}

export interface FilaClassificacio {
  edicio: number
  data_publicacio: string
  posicio: number | null
  jugador_numero: number
  nom_complet: string
  club: string | null
  barruf: string
  categoria: string | null
  estat: EstatJugador
  partides_totals: number
  victories_totals: string
  partides_temporada: number
  victories_temporada: string
  darrera_temporada: string | null
  debutant: boolean
}

export interface FitxaJugador {
  jugador_id: string
  numero: number
  nom_complet: string
  club: string | null
  barruf: string | null
  categoria: string | null
  estat: EstatJugador | null
  posicio: number | null
  partides_totals: number | null
  victories_totals: string | null
  percentatge_victories: string | null
  darrera_temporada: string | null
}

export interface FilaEvolucio {
  jugador_numero: number
  campionat_id: string
  campionat: string
  data: string
  temporada_codi: string
  barruf_abans: string
  partides: number
  victories: string
  esperanca: string
  factor_k: number
  variacio: string
  barruf_despres: string
}

export interface FilaEnfrontament {
  jugador_numero: number
  rival_numero: number
  rival: string
  campionat_id: string
  campionat: string
  data: string
  ronda: number
  resultat: string
  punts: number | null
  punts_rival: number | null
}

export interface CampionatPublic {
  id: string
  nom: string
  data: string
  temporada_codi: string
  organitzador: string | null
  club_organitzador: string | null
  computa_barruf: boolean
  finalitzat: boolean
  barrufat: boolean
  rondes_previstes: number | null
  rondes_jugades: number | null
  participants: number
  partides: number
}
