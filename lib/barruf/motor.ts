import {
  BARRUF_INICIAL,
  K_NOVELL,
  K_VETERA,
  LLINDAR_PARTIDES_K,
  SIGMA,
} from './constants'
import { normalCDF } from './normal'
import type {
  CampionatEntrada,
  EstatBarruf,
  PartidaResolta,
  VariacioBarruf,
} from './tipus'

/**
 * Probabilitat que el jugador guanyi una partida contra un adversari.
 *
 *     E = Φ( (BarrufJugador − BarrufAdversari) / σ )
 *
 * Cel·les BO:CS de `DadesTorneig`.
 */
export function esperancaPartida(barrufJugador: number, barrufAdversari: number): number {
  return normalCDF((barrufJugador - barrufAdversari) / SIGMA)
}

/**
 * Factor K. Depèn de les partides acumulades ABANS del campionat més les que
 * s'hi juguen, de manera que un jugador pot creuar el llindar dins del mateix
 * torneig que el fa veterà.
 *
 * Cel·la CU de `DadesTorneig`.
 */
export function factorK(partidesPrevies: number, partidesCampionat: number): number {
  return partidesPrevies + partidesCampionat > LLINDAR_PARTIDES_K ? K_VETERA : K_NOVELL
}

/** Estat inicial d'un jugador que encara no és a cap llista. */
export function estatInicial(jugadorId: string): EstatBarruf {
  return {
    jugadorId,
    barruf: BARRUF_INICIAL,
    partidesTotals: 0,
    victoriesTotals: 0,
    partidesTemporada: 0,
    victoriesTemporada: 0,
    darreraTemporada: null,
  }
}

/** Desdobla cada partida en les dues perspectives, descartant els BYE. */
function partidesDirigides(
  partides: PartidaResolta[],
): Map<string, { adversariId: string; resultat: number }[]> {
  const perJugador = new Map<string, { adversariId: string; resultat: number }[]>()

  const afegeix = (jugadorId: string, adversariId: string, resultat: number) => {
    const llista = perJugador.get(jugadorId)
    if (llista) llista.push({ adversariId, resultat })
    else perJugador.set(jugadorId, [{ adversariId, resultat }])
  }

  for (const partida of partides) {
    // Un BYE no és una partida jugada: no dona esperança ni mou el BARRUF.
    if (partida.jugador2Id === null) continue

    afegeix(partida.jugador1Id, partida.jugador2Id, partida.resultat1)
    afegeix(partida.jugador2Id, partida.jugador1Id, 1 - partida.resultat1)
  }

  return perJugador
}

/**
 * Calcula la variació de BARRUF de tots els participants d'un campionat.
 *
 *     E = Σ Φ( (BarrufJugador − BarrufAdversariᵣ) / σ )
 *     Δ = (Victòries − E) × K
 *
 * Les esperances es calculen totes amb els BARRUF d'ABANS del campionat: dins
 * d'un mateix torneig ningú no juga contra una puntuació ja actualitzada.
 *
 * Els inscrits que no han jugat cap partida no reben variació, tal com fa el
 * full (columna CV en blanc quan BN val zero).
 */
export function calculaCampionat(
  campionat: CampionatEntrada,
  estatPrevi: ReadonlyMap<string, EstatBarruf>,
): VariacioBarruf[] {
  const barrufDe = (jugadorId: string): number => {
    const estat = estatPrevi.get(jugadorId)
    // Un BARRUF absent o zero es tracta com a jugador nou, igual que fa el full
    // amb `if(VLOOKUP(...) = 0, H3, VLOOKUP(...))`.
    if (!estat || estat.barruf === 0) return BARRUF_INICIAL
    return estat.barruf
  }

  const perJugador = partidesDirigides(campionat.partides)
  const variacions: VariacioBarruf[] = []

  // Recorrem els inscrits, no les claus del mapa de partides, perquè l'ordre
  // de sortida ha de ser estable i cal contemplar qui no ha jugat res.
  for (const jugadorId of campionat.inscrits) {
    const partides = perJugador.get(jugadorId) ?? []
    if (partides.length === 0) continue

    const barrufAbans = barrufDe(jugadorId)
    const partidesPrevies = estatPrevi.get(jugadorId)?.partidesTotals ?? 0

    let esperanca = 0
    let victories = 0
    for (const { adversariId, resultat } of partides) {
      esperanca += esperancaPartida(barrufAbans, barrufDe(adversariId))
      victories += resultat
    }

    const k = factorK(partidesPrevies, partides.length)
    const variacio = (victories - esperanca) * k

    variacions.push({
      jugadorId,
      barrufAbans,
      partides: partides.length,
      victories,
      esperanca,
      factorK: k,
      variacio,
      barrufDespres: barrufAbans + variacio,
    })
  }

  return variacions
}

/**
 * Aplica les variacions d'un campionat i retorna l'estat resultant. No modifica
 * el mapa d'entrada: la cadena és una successió d'estats immutables, cosa que
 * fa que rejugar-la sigui sempre determinista.
 */
export function aplicaCampionat(
  campionat: CampionatEntrada,
  estatPrevi: ReadonlyMap<string, EstatBarruf>,
  variacions: VariacioBarruf[],
): Map<string, EstatBarruf> {
  const seguent = new Map<string, EstatBarruf>()
  for (const [id, estat] of estatPrevi) seguent.set(id, { ...estat })

  for (const variacio of variacions) {
    const previ = seguent.get(variacio.jugadorId) ?? estatInicial(variacio.jugadorId)

    // Els comptadors de temporada es reinicien en canviar de temporada.
    const mateixaTemporada = previ.darreraTemporada === campionat.temporadaCodi
    const partidesTemporada = mateixaTemporada ? previ.partidesTemporada : 0
    const victoriesTemporada = mateixaTemporada ? previ.victoriesTemporada : 0

    seguent.set(variacio.jugadorId, {
      jugadorId: variacio.jugadorId,
      barruf: variacio.barrufDespres,
      partidesTotals: previ.partidesTotals + variacio.partides,
      victoriesTotals: previ.victoriesTotals + variacio.victories,
      partidesTemporada: partidesTemporada + variacio.partides,
      victoriesTemporada: victoriesTemporada + variacio.victories,
      darreraTemporada: campionat.temporadaCodi,
    })
  }

  return seguent
}

export interface ResultatCadena {
  estatFinal: Map<string, EstatBarruf>
  variacionsPerCampionat: Map<string, VariacioBarruf[]>
}

/**
 * Rejuga la cadena sencera a partir d'una llavor.
 *
 * Aquesta és la raó de ser de tot el disseny: si es corregeix un resultat antic,
 * es torna a cridar aquesta funció i tota la història posterior es refà sola.
 *
 * Els campionats han d'arribar JA ORDENATS (data, ordre) i han de ser només els
 * que computen. Un campionat d'arxiu que s'hi colés mouria els BARRUF publicats.
 */
export function rejugaCadena(
  llavor: ReadonlyMap<string, EstatBarruf>,
  campionats: CampionatEntrada[],
): ResultatCadena {
  let estat: ReadonlyMap<string, EstatBarruf> = llavor
  const variacionsPerCampionat = new Map<string, VariacioBarruf[]>()

  for (const campionat of campionats) {
    const variacions = calculaCampionat(campionat, estat)
    variacionsPerCampionat.set(campionat.id, variacions)
    estat = aplicaCampionat(campionat, estat, variacions)
  }

  return { estatFinal: estat as Map<string, EstatBarruf>, variacionsPerCampionat }
}
