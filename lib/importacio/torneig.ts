/**
 * Lectura del torneig complet del SwissPerfect: `.trn`, `.sco` i `.ini`.
 *
 * Aquest és el camí d'importació bo. Els fitxers de text `.rnd` i `.stg`
 * (vegeu `swissperfect.ts`) són una exportació parcial del mateix: comparats amb
 * aquests tres fitxers els falten els noms dels jugadors i la puntuació
 * d'Scrabble, i a més cal que l'organitzador se'n recordi d'exportar totes les
 * rondes, cosa que al ManaCup no va passar.
 *
 * AVÍS SOBRE LES XIFRES: el SwissPerfect ho desa tot DOBLAT per treballar només
 * amb enters. `W_SCORE` val 2 per una victòria, 1 per un empat i 0 per una
 * derrota, i `W_SUBSCO` és el doble de la puntuació d'Scrabble. Comprovat amb
 * el ManaCup: la primera partida hi consta 722–766 i al full de l'AJUSC és
 * 361–383.
 */

import { llegeixDbase, type ValorDbase } from './dbase'
import type { ResultatSwiss } from './swissperfect'

export interface ParticipantTorneig {
  /** Identificador intern del torneig. És el que referencien els resultats. */
  id: number
  /** Número de sortida, tal com surt als llistats de l'organitzador. */
  numeroSortida: string
  cognoms: string
  nom: string
  /** Nom sencer per mostrar i per resoldre contra el registre de l'AJUSC. */
  nomComplet: string
  club: string
  federacio: string
  /** Puntuació amb què el jugador entra al torneig. Sol ser el seu BARRUF. */
  puntuacioInicial: number | null
  /** Ronda a partir de la qual es retira. `null` si no es retira. */
  retiratDesDeLaRonda: number | null
}

export interface PartidaTorneig {
  ronda: number
  blancId: number
  negreId: number
  resultatBlanc: ResultatSwiss
  /** Puntuació d'Scrabble. `null` si el torneig no la registra. */
  puntsBlanc: number | null
  puntsNegre: number | null
}

export interface InfoTorneig {
  nom: string
  organitzador: string
  arbitre: string
  rondesPrevistes: number | null
}

export interface Torneig {
  info: InfoTorneig | null
  participants: ParticipantTorneig[]
  partides: PartidaTorneig[]
  /** Rondes amb alguna partida jugada. */
  rondesJugades: number[]
  /** Rondes aparellades però encara no jugades. */
  rondesPendents: number[]
}

export class ErrorTorneig extends Error {
  constructor(missatge: string) {
    super(missatge)
    this.name = 'ErrorTorneig'
  }
}

const enter = (valor: ValorDbase): number | null =>
  typeof valor === 'number' ? valor : null

const cadena = (valor: ValorDbase): string => (typeof valor === 'string' ? valor : '')

/** Llegeix el fitxer `.trn` amb la llista de participants. */
export function llegeixParticipants(dades: Uint8Array): ParticipantTorneig[] {
  const { registres } = llegeixDbase(dades)

  const participants: ParticipantTorneig[] = []
  for (const registre of registres) {
    // El SwissPerfect deixa registres en blanc de reserva al final del fitxer:
    // al ManaCup n'hi ha 7 per a 65 jugadors.
    const cognoms = cadena(registre.SURNAME)
    if (cognoms === '') continue

    const id = enter(registre.ID)
    if (id === null) {
      throw new ErrorTorneig(`El participant '${cognoms}' no té identificador`)
    }

    const nom = cadena(registre.FIRSTNAME)
    participants.push({
      id,
      numeroSortida: cadena(registre.START_NO),
      cognoms,
      nom,
      nomComplet: [nom, cognoms].filter((part) => part !== '').join(' '),
      club: cadena(registre.CLUB),
      federacio: cadena(registre.FEDER),
      puntuacioInicial: enter(registre.INTL_RTG),
      retiratDesDeLaRonda: enter(registre.WITHDRAWAL),
    })
  }

  const identificadors = new Set<number>()
  for (const participant of participants) {
    if (identificadors.has(participant.id)) {
      throw new ErrorTorneig(`L'identificador ${participant.id} surt dues vegades al .trn`)
    }
    identificadors.add(participant.id)
  }

  return participants
}

function resultatDesDoblat(doblat: number, ronda: number): ResultatSwiss {
  if (doblat === 2) return 1
  if (doblat === 1) return 0.5
  if (doblat === 0) return 0
  throw new ErrorTorneig(
    `Ronda ${ronda}: puntuació ${doblat} desconeguda; el SwissPerfect només escriu 0, 1 o 2`,
  )
}

function puntsDesDoblats(doblat: number | null, ronda: number, camp: string): number | null {
  if (doblat === null || doblat === 0) return null
  if (doblat % 2 !== 0) {
    throw new ErrorTorneig(
      `Ronda ${ronda}, ${camp}: ${doblat} no és parell i la puntuació hauria de ser el doble de la real`,
    )
  }
  return doblat / 2
}

/** Llegeix el fitxer `.sco` amb tots els resultats. */
export function llegeixResultats(dades: Uint8Array): {
  partides: PartidaTorneig[]
  rondesJugades: number[]
  rondesPendents: number[]
} {
  const { registres } = llegeixDbase(dades)

  const partides: PartidaTorneig[] = []
  const jugades = new Set<number>()
  const pendents = new Set<number>()

  for (const registre of registres) {
    const ronda = enter(registre.ROUND)
    const blancId = enter(registre.WHITE)
    const negreId = enter(registre.BLACK)
    if (ronda === null || blancId === null || negreId === null) continue

    // W_TYPE i B_TYPE valen 1 quan la partida s'ha jugat. Les rondes ja
    // aparellades però pendents hi consten amb tot a zero.
    const jugada = enter(registre.W_TYPE) === 1 && enter(registre.B_TYPE) === 1
    if (!jugada) {
      pendents.add(ronda)
      continue
    }

    const resultatBlanc = resultatDesDoblat(enter(registre.W_SCORE) ?? 0, ronda)
    const resultatNegre = resultatDesDoblat(enter(registre.B_SCORE) ?? 0, ronda)
    if (resultatBlanc + resultatNegre !== 1) {
      throw new ErrorTorneig(
        `Ronda ${ronda}, ${blancId} contra ${negreId}: els resultats no sumen 1`,
      )
    }

    jugades.add(ronda)
    partides.push({
      ronda,
      blancId,
      negreId,
      resultatBlanc,
      puntsBlanc: puntsDesDoblats(enter(registre.W_SUBSCO), ronda, 'W_SUBSCO'),
      puntsNegre: puntsDesDoblats(enter(registre.B_SUBSCO), ronda, 'B_SUBSCO'),
    })
  }

  const ordena = (conjunt: Set<number>) => [...conjunt].sort((a, b) => a - b)
  return {
    partides,
    rondesJugades: ordena(jugades),
    // Una ronda a mig jugar surt a les dues bandes; compta com a jugada.
    rondesPendents: ordena(pendents).filter((r) => !jugades.has(r)),
  }
}

/** Llegeix el `.ini` amb les dades generals del torneig. */
export function llegeixInfo(contingut: string): InfoTorneig {
  const seccions = new Map<string, Map<string, string>>()
  let actual = new Map<string, string>()

  for (const linia of contingut.split(/\r?\n/)) {
    const net = linia.trim()
    if (net === '' || net.startsWith(';')) continue

    const capcalera = net.match(/^\[(.+)\]$/)
    if (capcalera) {
      actual = new Map<string, string>()
      seccions.set(capcalera[1], actual)
      continue
    }

    const separador = net.indexOf('=')
    if (separador > 0) {
      actual.set(net.slice(0, separador).trim(), net.slice(separador + 1).trim())
    }
  }

  const torneig = seccions.get('Tournament Info') ?? new Map<string, string>()
  const rondes = Number.parseInt(torneig.get('Rounds') ?? '', 10)

  return {
    nom: torneig.get('Name') ?? '',
    organitzador: torneig.get('Organiser') ?? '',
    arbitre: torneig.get('Arbiter') ?? '',
    rondesPrevistes: Number.isNaN(rondes) ? null : rondes,
  }
}

export interface FitxersTorneig {
  trn: Uint8Array
  sco: Uint8Array
  ini?: string
}

/**
 * Ajunta els tres fitxers en un torneig coherent i comprova que els resultats
 * no referenciïn jugadors que no surten a la llista de participants.
 */
export function llegeixTorneig({ trn, sco, ini }: FitxersTorneig): Torneig {
  const participants = llegeixParticipants(trn)
  const { partides, rondesJugades, rondesPendents } = llegeixResultats(sco)

  const coneguts = new Set(participants.map((p) => p.id))
  for (const partida of partides) {
    for (const jugador of [partida.blancId, partida.negreId]) {
      if (!coneguts.has(jugador)) {
        throw new ErrorTorneig(
          `La ronda ${partida.ronda} fa servir el jugador ${jugador}, que no surt al .trn`,
        )
      }
    }
  }

  const perRonda = new Map<number, Set<number>>()
  for (const partida of partides) {
    const jugadorsDeLaRonda = perRonda.get(partida.ronda) ?? new Set<number>()
    for (const jugador of [partida.blancId, partida.negreId]) {
      if (jugadorsDeLaRonda.has(jugador)) {
        throw new ErrorTorneig(
          `El jugador ${jugador} té més d'una partida a la ronda ${partida.ronda}`,
        )
      }
      jugadorsDeLaRonda.add(jugador)
    }
    perRonda.set(partida.ronda, jugadorsDeLaRonda)
  }

  return {
    info: ini === undefined ? null : llegeixInfo(ini),
    participants,
    partides,
    rondesJugades,
    rondesPendents,
  }
}

/** Partides jugades per cada participant. Els descansos no hi compten. */
export function partidesPerParticipant(torneig: Torneig): Map<number, number> {
  const compte = new Map<number, number>()
  const suma = (jugador: number) => compte.set(jugador, (compte.get(jugador) ?? 0) + 1)
  for (const partida of torneig.partides) {
    suma(partida.blancId)
    suma(partida.negreId)
  }
  return compte
}
