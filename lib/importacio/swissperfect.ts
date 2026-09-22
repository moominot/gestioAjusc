/**
 * Lectura dels fitxers d'exportació del SwissPerfect.
 *
 * El SwissPerfect exporta cada ronda en un fitxer `.rnd` i les classificacions
 * en fitxers `.stg`, tots dos delimitats per barres verticals i amb capçalera.
 *
 * Els `.rnd` són l'única font de veritat. Els `.stg` només serveixen per
 * contrastar, mai per importar: contenen valors ja calculats pel SwissPerfect
 * (Buchholz, Berger) que no tenen res a veure amb el BARRUF, i a més el número
 * del nom del fitxer no diu quantes rondes cobreixen de debò —vegeu
 * `dedueixRondesCobertes()`.
 */

/** Resultat d'una partida des del punt de vista del jugador blanc. */
export type ResultatSwiss = 0 | 0.5 | 1

export interface PartidaSwiss {
  ronda: number
  taula: number
  blancId: number
  negreId: number
  resultatBlanc: ResultatSwiss
}

export interface FilaClassificacio {
  posicio: number
  /** Rang de posicions empatades, p. ex. '1-5'. Buit si no n'hi ha. */
  posicioAgrupada: string
  jugadorId: number
  puntuacio: number
  victories: number
  medianBuchholz: number
  buchholz: number
  berger: number
}

export interface CampionatSwiss {
  /** Números de ronda presents, ordenats. */
  rondes: number[]
  /** Identificadors locals del torneig, ordenats. */
  jugadors: number[]
  partides: PartidaSwiss[]
  /** Rondes que falten dins del rang, si l'exportació és incompleta. */
  rondesQueFalten: number[]
}

const CAPCALERA_RONDA = 'ROUND|TABLE_NO|WHITE_ID|BLACK_ID|WHITE_SCORE|BLACK_SCORE'
const CAPCALERA_CLASSIFICACIO =
  'PLACING|SHORT_PLACING|PLAYER_ID|TOTAL_SCORE|TB_NUMBER_OF_WINS|TB_MED_BUCHHOLZ|TB_BUCHHOLZ|TB_BERGER'

export class ErrorSwissPerfect extends Error {
  constructor(missatge: string) {
    super(missatge)
    this.name = 'ErrorSwissPerfect'
  }
}

function linies(contingut: string): string[] {
  return contingut
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

function enter(valor: string, context: string): number {
  const numero = Number.parseInt(valor, 10)
  if (Number.isNaN(numero)) {
    throw new ErrorSwissPerfect(`${context}: '${valor}' no és un nombre enter`)
  }
  return numero
}

function decimal(valor: string, context: string): number {
  const numero = Number.parseFloat(valor)
  if (Number.isNaN(numero)) {
    throw new ErrorSwissPerfect(`${context}: '${valor}' no és un nombre`)
  }
  return numero
}

function resultat(valor: string, context: string): ResultatSwiss {
  if (valor === '1') return 1
  if (valor === '0') return 0
  if (valor === '0.5') return 0.5
  // Val més plantar-se que endevinar: el SwissPerfect pot escriure marques
  // d'incompareixença que no sabem interpretar, i un resultat mal llegit es
  // propaga silenciosament a tota la cadena del BARRUF.
  throw new ErrorSwissPerfect(
    `${context}: resultat '${valor}' desconegut; només s'accepten 1, 0 i 0.5`,
  )
}

/** Llegeix un fitxer `.rnd`. */
export function llegeixRonda(contingut: string, nomFitxer = '.rnd'): PartidaSwiss[] {
  const files = linies(contingut)
  if (files.length === 0) {
    throw new ErrorSwissPerfect(`${nomFitxer}: el fitxer és buit`)
  }
  if (files[0] !== CAPCALERA_RONDA) {
    throw new ErrorSwissPerfect(
      `${nomFitxer}: capçalera inesperada.\n  esperada: ${CAPCALERA_RONDA}\n  trobada:  ${files[0]}`,
    )
  }

  const partides: PartidaSwiss[] = []
  const vistos = new Map<number, Set<number>>()

  for (const [index, fila] of files.slice(1).entries()) {
    const context = `${nomFitxer}, línia ${index + 2}`
    const camps = fila.split('|')
    if (camps.length !== 6) {
      throw new ErrorSwissPerfect(`${context}: s'esperaven 6 camps i n'hi ha ${camps.length}`)
    }

    const partida: PartidaSwiss = {
      ronda: enter(camps[0], context),
      taula: enter(camps[1], context),
      blancId: enter(camps[2], context),
      negreId: enter(camps[3], context),
      resultatBlanc: resultat(camps[4], context),
    }

    const resultatNegre = resultat(camps[5], context)
    if (partida.resultatBlanc + resultatNegre !== 1) {
      throw new ErrorSwissPerfect(
        `${context}: els dos resultats no sumen 1 ` +
          `(${partida.resultatBlanc} i ${resultatNegre})`,
      )
    }

    if (partida.blancId === partida.negreId) {
      throw new ErrorSwissPerfect(`${context}: el jugador ${partida.blancId} juga contra si mateix`)
    }

    const deLaRonda = vistos.get(partida.ronda) ?? new Set<number>()
    for (const jugador of [partida.blancId, partida.negreId]) {
      if (deLaRonda.has(jugador)) {
        throw new ErrorSwissPerfect(
          `${context}: el jugador ${jugador} ja té una partida a la ronda ${partida.ronda}`,
        )
      }
      deLaRonda.add(jugador)
    }
    vistos.set(partida.ronda, deLaRonda)

    partides.push(partida)
  }

  const rondes = new Set(partides.map((p) => p.ronda))
  if (rondes.size > 1) {
    throw new ErrorSwissPerfect(
      `${nomFitxer}: el fitxer barreja les rondes ${[...rondes].sort((a, b) => a - b).join(', ')}`,
    )
  }

  return partides
}

/** Llegeix un fitxer `.stg`. */
export function llegeixClassificacio(
  contingut: string,
  nomFitxer = '.stg',
): FilaClassificacio[] {
  const files = linies(contingut)
  if (files.length === 0) {
    throw new ErrorSwissPerfect(`${nomFitxer}: el fitxer és buit`)
  }
  // La capçalera acaba amb dues barres sobreres que no corresponen a cap columna.
  if (!files[0].startsWith(CAPCALERA_CLASSIFICACIO)) {
    throw new ErrorSwissPerfect(
      `${nomFitxer}: capçalera inesperada.\n  esperada: ${CAPCALERA_CLASSIFICACIO}\n  trobada:  ${files[0]}`,
    )
  }

  return files.slice(1).map((fila, index) => {
    const context = `${nomFitxer}, línia ${index + 2}`
    const camps = fila.split('|')
    if (camps.length < 8) {
      throw new ErrorSwissPerfect(
        `${context}: s'esperaven com a mínim 8 camps i n'hi ha ${camps.length}`,
      )
    }
    return {
      posicio: enter(camps[0], context),
      posicioAgrupada: camps[1],
      jugadorId: enter(camps[2], context),
      puntuacio: decimal(camps[3], context),
      victories: enter(camps[4], context),
      medianBuchholz: decimal(camps[5], context),
      buchholz: decimal(camps[6], context),
      berger: decimal(camps[7], context),
    }
  })
}

/**
 * Ajunta les rondes en un campionat.
 *
 * Al SwissPerfect un jugador que descansa simplement no surt a la ronda: no hi
 * ha cap marca de BYE. Això ja va bé, perquè per al BARRUF un descans tampoc no
 * és una partida jugada.
 */
export function construeixCampionat(fitxersRonda: string[]): CampionatSwiss {
  const partides = fitxersRonda.flatMap((contingut, index) =>
    llegeixRonda(contingut, `ronda ${index + 1}`),
  )

  if (partides.length === 0) {
    throw new ErrorSwissPerfect('No hi ha cap partida a les rondes rebudes')
  }

  const rondes = [...new Set(partides.map((p) => p.ronda))].sort((a, b) => a - b)
  if (rondes.length !== fitxersRonda.length) {
    throw new ErrorSwissPerfect(
      `S'han rebut ${fitxersRonda.length} fitxers però només ${rondes.length} rondes diferents: ` +
        'hi ha alguna ronda repetida',
    )
  }

  const jugadors = [
    ...new Set(partides.flatMap((p) => [p.blancId, p.negreId])),
  ].sort((a, b) => a - b)

  const rondesQueFalten: number[] = []
  for (let ronda = rondes[0]; ronda <= rondes[rondes.length - 1]; ronda++) {
    if (!rondes.includes(ronda)) rondesQueFalten.push(ronda)
  }

  return { rondes, jugadors, partides, rondesQueFalten }
}

/** Punts que ha sumat cada jugador a les rondes rebudes. */
export function puntuacionsPerJugador(campionat: CampionatSwiss): Map<number, number> {
  const punts = new Map<number, number>()
  const suma = (jugador: number, valor: number) =>
    punts.set(jugador, (punts.get(jugador) ?? 0) + valor)

  for (const partida of campionat.partides) {
    suma(partida.blancId, partida.resultatBlanc)
    suma(partida.negreId, 1 - partida.resultatBlanc)
  }
  return punts
}

/**
 * Dedueix quantes rondes cobreix una classificació a partir del total de punts
 * repartits, en comptes de refiar-se del número del nom del fitxer.
 *
 * Cal fer-ho perquè el número del nom menteix: al ManaCup 2025-26, el fitxer
 * `ManaCup_25-26.21.stg` conté la classificació de 19 rondes, no de 21.
 *
 * Retorna `null` si el total no és múltiple del nombre de taules per ronda, cosa
 * que passa si hi ha hagut incompareixences o rondes de mida diferent.
 */
export function dedueixRondesCobertes(
  classificacio: FilaClassificacio[],
  taulesPerRonda: number,
): number | null {
  if (taulesPerRonda <= 0) return null
  const total = classificacio.reduce((suma, fila) => suma + fila.puntuacio, 0)
  const rondes = total / taulesPerRonda
  return Number.isInteger(rondes) ? rondes : null
}

export interface Discrepancia {
  jugadorId: number
  puntsCalculats: number
  puntsClassificacio: number
  motiu: string
}

/**
 * Contrasta les rondes contra una classificació.
 *
 * `rondesCobertes` són les N PRIMERES rondes del torneig: les classificacions
 * del SwissPerfect sempre són acumulades des de la ronda 1. Feu servir
 * `dedueixRondesCobertes()` per saber quantes són de debò.
 *
 * Amb l'exportació completa els números han de quadrar exactament. Si hi manca
 * alguna ronda, el que es comprova és que la diferència sigui plausible: mai
 * negativa, i mai més gran que les rondes que falten.
 *
 * Amb rondes absents, doncs, el contrast només enxampa desquadraments grossos.
 * La tolerància és d'un punt per ronda absent, i un únic resultat capgirat hi
 * cap de sobres. Per auditar resultat a resultat cal l'exportació sencera.
 */
export function contrastaAmbClassificacio(
  campionat: CampionatSwiss,
  classificacio: FilaClassificacio[],
  rondesCobertes: number,
): Discrepancia[] {
  const calculats = puntuacionsPerJugador({
    ...campionat,
    partides: campionat.partides.filter((p) => p.ronda <= rondesCobertes),
  })

  const rondesPresents = campionat.rondes.filter((r) => r <= rondesCobertes).length
  const rondesAbsents = rondesCobertes - rondesPresents

  const discrepancies: Discrepancia[] = []
  for (const fila of classificacio) {
    const calculat = calculats.get(fila.jugadorId) ?? 0
    const diferencia = fila.puntuacio - calculat

    if (diferencia < 0) {
      discrepancies.push({
        jugadorId: fila.jugadorId,
        puntsCalculats: calculat,
        puntsClassificacio: fila.puntuacio,
        motiu: 'les rondes donen més punts dels que consten a la classificació',
      })
    } else if (diferencia > rondesAbsents) {
      discrepancies.push({
        jugadorId: fila.jugadorId,
        puntsCalculats: calculat,
        puntsClassificacio: fila.puntuacio,
        motiu:
          `hi falten ${diferencia} punts i només ${rondesAbsents} ` +
          'rondes absents els podrien justificar',
      })
    }
  }

  return discrepancies
}
