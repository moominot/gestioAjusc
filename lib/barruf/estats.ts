import { LLINDAR_PARTIDES_ACTIU, TEMPORADES_INACTIVITAT } from './constants'
import type { EstatJugador } from './tipus'

/** Any d'inici d'un codi de temporada: '2025-26' → 2025. */
export function anyTemporada(codi: string): number {
  const any = Number.parseInt(codi.slice(0, 4), 10)
  if (Number.isNaN(any)) {
    throw new Error(`Codi de temporada no vàlid: ${codi}`)
  }
  return any
}

export interface EntradaEstat {
  partidesTotals: number
  /** Darrera temporada amb un campionat barrufat jugat. */
  darreraTemporada: string | null
  /** Temporada en curs, la del moment en què es publica la llista. */
  temporadaActual: string
  /**
   * Cohort anterior al 2014-15, importat del full amb la marca `<=2013-14`.
   * D'aquests jugadors no se'n conserva la temporada concreta i van passar a
   * inactius en bloc. Només afecta les files de la llavor: tot el que entri a
   * partir d'ara sempre porta temporada.
   */
  cohortLlegat?: boolean
}

/**
 * Deriva l'estat d'un jugador. No es desa mai com a veritat: es recalcula.
 *
 * L'ordre de les regles importa. En particular, `exp` té prioritat sobre
 * `inact`: un jugador amb BARRUF provisional que fa anys que no juga es queda
 * en expectativa i no es desactiva mai, perquè mai ha arribat a tenir un BARRUF
 * ferm del qual retirar-lo.
 *
 * Validat contra els 609 jugadors del GENERADOR_BARRUF: reprodueix els quatre
 * estats sense cap excepció.
 */
export function calculaEstat({
  partidesTotals,
  darreraTemporada,
  temporadaActual,
  cohortLlegat = false,
}: EntradaEstat): EstatJugador {
  // Inscrit però encara no ha jugat mai.
  if (partidesTotals <= 0) return 'nov'

  // Ha jugat, però abans que se'n registrés la temporada.
  if (cohortLlegat) return 'inact'

  // BARRUF provisional. Es manté indefinidament, també si fa anys que no juga.
  if (partidesTotals <= LLINDAR_PARTIDES_ACTIU) return 'exp'

  // Amb BARRUF ferm però sense constància de quan va jugar, val més desactivar.
  if (darreraTemporada === null) return 'inact'

  const llindar = anyTemporada(temporadaActual) - TEMPORADES_INACTIVITAT
  return anyTemporada(darreraTemporada) >= llindar ? 'act' : 'inact'
}
