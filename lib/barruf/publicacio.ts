/**
 * Càlcul d'una edició del BARRUF.
 *
 * Publicar una edició vol dir rejugar la cadena sencera des de la llavor i
 * desar-ne el resultat. No s'actualitza res de manera incremental: es recalcula
 * tot cada vegada. Amb 700 jugadors i 45.000 resultats això són mil·lisegons, i
 * a canvi corregir un resultat antic i tornar a publicar refà tota la història
 * posterior sola.
 */

import { LLINDAR_PARTIDES_ACTIU } from './constants'
import { calculaEstat } from './estats'
import { estatInicial, rejugaCadena } from './motor'
import type { CampionatEntrada, EstatBarruf, EstatJugador, VariacioBarruf } from './tipus'

/** Estat d'un jugador al punt de partida de la cadena. */
export interface JugadorLlavor {
  jugadorId: string
  barruf: number
  partidesTotals: number
  victoriesTotals: number
  partidesTemporada: number
  victoriesTemporada: number
  darreraTemporada: string | null
  /** Cohort anterior al 2014-15, del qual no se'n conserva la temporada. */
  cohortLlegat: boolean
}

/** Una fila de la llista publicada. */
export interface ValorPublicat {
  jugadorId: string
  barruf: number
  partidesTotals: number
  victoriesTotals: number
  partidesTemporada: number
  victoriesTemporada: number
  estat: EstatJugador
  darreraTemporada: string | null
  cohortLlegat: boolean
  /** Només els actius en tenen. */
  posicio: number | null
  debutant: boolean
}

export interface Edicio {
  valors: ValorPublicat[]
  /** Detall auditable de cada campionat de la cadena. */
  variacions: Map<string, VariacioBarruf[]>
}

/**
 * Debutant a la temporada en curs: la primera temporada amb un BARRUF ferm.
 *
 * És la regla del full (`Dades9Barruf!I`): ha passat de 10 partides, però abans
 * d'aquesta temporada en tenia 10 o menys. Qui juga per primer cop però encara
 * no n'ha fet 10 és a la llista d'espera i no ho és; qui en va jugar poques
 * l'any passat i aquest any passa a actiu, sí.
 */
export function esDebutant(partidesTotals: number, partidesTemporada: number): boolean {
  return partidesTotals > LLINDAR_PARTIDES_ACTIU && partidesTotals - partidesTemporada <= LLINDAR_PARTIDES_ACTIU
}

/**
 * Assigna posicions amb el criteri de sempre: els empatats comparteixen
 * posició i la següent se salta tantes places com empats hi hagi.
 */
function assignaPosicions(actius: ValorPublicat[]): void {
  const ordenats = [...actius].sort((a, b) => b.barruf - a.barruf)

  let posicio = 0
  let anterior: number | null = null
  ordenats.forEach((valor, index) => {
    if (anterior === null || valor.barruf !== anterior) {
      posicio = index + 1
      anterior = valor.barruf
    }
    valor.posicio = posicio
  })
}

/**
 * Calcula una edició nova.
 *
 * `campionats` han de ser NOMÉS els que entren a la cadena —els que computen i
 * estan finalitzats— i han d'arribar ordenats per (data, ordre). Un campionat
 * d'arxiu que s'hi colés mouria tots els BARRUF publicats.
 *
 * `temporadaActual` decideix els estats: és el moment des del qual es mira qui
 * fa dues temporades que no juga. Com que l'escombrada d'inactivitat s'aplica a
 * l'inici de temporada, publicar amb una temporada o una altra dona llistes
 * diferents, i això és volgut.
 */
export function calculaEdicio(
  llavor: JugadorLlavor[],
  campionats: CampionatEntrada[],
  temporadaActual: string,
): Edicio {
  const estatInici = new Map<string, EstatBarruf>(
    llavor.map((j) => [
      j.jugadorId,
      {
        ...estatInicial(j.jugadorId),
        barruf: j.barruf,
        partidesTotals: j.partidesTotals,
        victoriesTotals: j.victoriesTotals,
        partidesTemporada: j.partidesTemporada,
        victoriesTemporada: j.victoriesTemporada,
        darreraTemporada: j.darreraTemporada,
      },
    ]),
  )

  const { estatFinal, variacionsPerCampionat } = rejugaCadena(estatInici, campionats)

  const cohortPerJugador = new Map(llavor.map((j) => [j.jugadorId, j.cohortLlegat]))
  const haJugat = new Set<string>()
  for (const variacions of variacionsPerCampionat.values()) {
    for (const variacio of variacions) haJugat.add(variacio.jugadorId)
  }

  const valors: ValorPublicat[] = []
  for (const [jugadorId, estat] of estatFinal) {
    // Qui ha jugat un campionat de la cadena ja té temporada coneguda i deixa
    // de pertànyer al cohort de llegat.
    const cohortLlegat = haJugat.has(jugadorId)
      ? false
      : (cohortPerJugador.get(jugadorId) ?? false)

    // Els comptadors de temporada són els de la temporada en curs. Qui no hi ha
    // jugat els té a zero, encara que n'arrossegui de temporades anteriors.
    const deLaTemporada = estat.darreraTemporada === temporadaActual
    const partidesTemporada = deLaTemporada ? estat.partidesTemporada : 0
    const victoriesTemporada = deLaTemporada ? estat.victoriesTemporada : 0

    valors.push({
      jugadorId,
      barruf: estat.barruf,
      partidesTotals: estat.partidesTotals,
      victoriesTotals: estat.victoriesTotals,
      partidesTemporada,
      victoriesTemporada,
      estat: calculaEstat({
        partidesTotals: estat.partidesTotals,
        darreraTemporada: estat.darreraTemporada,
        temporadaActual,
        cohortLlegat,
      }),
      darreraTemporada: estat.darreraTemporada,
      cohortLlegat,
      posicio: null,
      debutant: esDebutant(estat.partidesTotals, partidesTemporada),
    })
  }

  assignaPosicions(valors.filter((v) => v.estat === 'act'))

  // Ordre estable: primer els que tenen posició, després la resta per BARRUF.
  valors.sort(
    (a, b) =>
      (a.posicio ?? Number.MAX_SAFE_INTEGER) - (b.posicio ?? Number.MAX_SAFE_INTEGER) ||
      b.barruf - a.barruf ||
      a.jugadorId.localeCompare(b.jugadorId),
  )

  return { valors, variacions: variacionsPerCampionat }
}
