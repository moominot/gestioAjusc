/**
 * Lectura de resultats des d'un full de càlcul o un CSV.
 *
 * No tots els clubs fan servir SwissPerfect. Aquest camí accepta la mateixa
 * llista de resultats que ja fa servir el generador de l'AJUSC:
 *
 *     Ronda | Jugador 1 | Puntuació 1 | Jugador 2 | Puntuació 2
 *
 * Els noms de les columnes s'accepten amb força variants, i la puntuació tant
 * pot ser la de la partida d'Scrabble com el resultat en 1 / 0,5 / 0.
 *
 * A diferència del SwissPerfect, aquí els jugadors venen identificats pel nom.
 * Se'ls assigna un número local per ordre d'aparició, que només serveix per
 * lligar les partides fins que la resolució d'identitats els doni el del
 * registre.
 */

import type { ResultatSwiss } from './swissperfect'
import type {
  EstadistiquesJugador,
  EstadistiquesPartida,
  ParticipantTorneig,
  PartidaTorneig,
  Torneig,
} from './torneig'

import { netejaNom, normalitzaNom } from './noms'

export class ErrorFull extends Error {
  constructor(missatge: string) {
    super(missatge)
    this.name = 'ErrorFull'
  }
}

/** Marca que el jugador va descansar aquella ronda. */
const PARAULES_BYE = new Set(['bye', 'descansa', 'descans', '-', '—'])

const COLUMNES: Record<string, string[]> = {
  ronda: ['ronda', 'r', 'round', 'rnd'],
  jugador1: ['jugador 1', 'jugador1', 'jugador a', 'blanc', 'white', 'player 1', 'local'],
  puntuacio1: [
    'puntuacio 1',
    'puntuacio1',
    'punts 1',
    'resultat 1',
    'score 1',
    'p1',
    'white score',
  ],
  jugador2: ['jugador 2', 'jugador2', 'jugador b', 'negre', 'black', 'player 2', 'visitant'],
  puntuacio2: [
    'puntuacio 2',
    'puntuacio2',
    'punts 2',
    'resultat 2',
    'score 2',
    'p2',
    'black score',
  ],
  // Estadístiques, opcionals. Els noms són els del full de les temporades
  // del Club Scrabble Manacor (Scrabbles_1, Mot_1, Puntsmot_1, Lletra_1,
  // Punts_lletra_1) i unes quantes variants més llegibles.
  scrabbles1: ['scrabbles 1', 'scrabbles1'],
  scrabbles2: ['scrabbles 2', 'scrabbles2'],
  mot1: ['mot 1', 'mot1', 'millor mot 1', 'millor jugada 1'],
  mot2: ['mot 2', 'mot2', 'millor mot 2', 'millor jugada 2'],
  puntsMot1: ['puntsmot 1', 'punts mot 1', 'punts millor mot 1', 'punts millor jugada 1'],
  puntsMot2: ['puntsmot 2', 'punts mot 2', 'punts millor mot 2', 'punts millor jugada 2'],
  motLletra1: ['lletra 1', 'mot lletra 1', 'millor lletra 1'],
  motLletra2: ['lletra 2', 'mot lletra 2', 'millor lletra 2'],
  puntsLletra1: ['punts lletra 1', 'punts mot lletra 1', 'punts millor lletra 1'],
  puntsLletra2: ['punts lletra 2', 'punts mot lletra 2', 'punts millor lletra 2'],
}

// Els guions baixos valen com a espais: «Puntuacio_1» és «Puntuacio 1».
const normalitzaCapcalera = (text: string) => normalitzaNom(String(text ?? '').replace(/_/g, ' '))

/**
 * Associa cada columna que ens interessa amb la seva posició a la capçalera.
 *
 * Mana l'ordre dels sinònims, no el de les columnes: si el full porta alhora
 * «Punts 1» (el resultat, 1 o 0) i «Puntuació 1» (la de la partida), es queda
 * la puntuació, que és la primera de la llista.
 */
function mapaColumnes(capcalera: unknown[]): Record<string, number> {
  const normalitzades = capcalera.map((c) => normalitzaCapcalera(String(c ?? '')))
  const mapa: Record<string, number> = {}

  for (const [clau, sinonims] of Object.entries(COLUMNES)) {
    for (const sinonim of sinonims) {
      const posicio = normalitzades.indexOf(sinonim)
      if (posicio >= 0) {
        mapa[clau] = posicio
        break
      }
    }
  }

  const obligatories = ['jugador1', 'puntuacio1', 'jugador2', 'puntuacio2']
  const absents = obligatories.filter((clau) => !(clau in mapa))
  if (absents.length > 0) {
    throw new ErrorFull(
      `No trobo les columnes ${absents.join(', ')}. ` +
        `La capçalera hauria de tenir: Ronda, Jugador 1, Puntuació 1, Jugador 2, Puntuació 2. ` +
        `Hi he llegit: ${capcalera.map((c) => `«${String(c ?? '')}»`).join(', ')}`,
    )
  }

  return mapa
}

function aNombre(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  // Els fulls en català escriuen els decimals amb coma.
  const text = String(valor).trim().replace(',', '.')
  if (text === '') return null
  const numero = Number(text)
  return Number.isFinite(numero) ? numero : null
}

const ES_RESULTAT = (valor: number) => valor === 0 || valor === 0.5 || valor === 1

/**
 * Decideix si les dues xifres són el resultat de la partida o la puntuació
 * d'Scrabble, i retorna el resultat del primer jugador.
 *
 * Quan totes dues són 0, 0,5 o 1 i sumen 1, és el resultat: no hi ha cap
 * partida d'Scrabble que acabi 1 a 0 ni que doni mig punt. Altrament es
 * comparen les puntuacions.
 */
export function interpretaResultat(
  puntuacio1: number,
  puntuacio2: number,
): { resultat: ResultatSwiss; sonPuntsScrabble: boolean } {
  if (ES_RESULTAT(puntuacio1) && ES_RESULTAT(puntuacio2) && puntuacio1 + puntuacio2 === 1) {
    return { resultat: puntuacio1 as ResultatSwiss, sonPuntsScrabble: false }
  }
  const resultat: ResultatSwiss = puntuacio1 > puntuacio2 ? 1 : puntuacio1 < puntuacio2 ? 0 : 0.5
  return { resultat, sonPuntsScrabble: true }
}

export interface FilaResultat {
  /** Número de fila al full, per poder assenyalar els errors. */
  fila: number
  ronda: number | null
  jugador1: string
  puntuacio1: number
  jugador2: string | null
  puntuacio2: number | null
  /** `null` si el full no en porta cap per a aquesta partida. */
  estadistiques?: EstadistiquesPartida | null
}

/**
 * Un mot tal com es desa: en majúscules i amb la ela geminada ben escrita,
 * perquè als fulls s'hi troba «Il.lesa», «AL-LE» o «al·le».
 */
export function normalitzaMot(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null
  const text = String(valor).replace(/\s+/g, ' ').trim()
  if (text === '' || text === '-' || text === '0') return null
  return text
    .replace(/ŀl/gi, 'l·l')
    .replace(/l[.\-·•∙]l/gi, 'l·l')
    .toLocaleUpperCase('ca')
}

const enter = (valor: unknown): number | null => {
  const numero = aNombre(valor)
  return numero === null ? null : Math.round(numero)
}

function estadistiquesDe(fila: unknown[], columnes: Record<string, number>): EstadistiquesPartida | null {
  const cel = (clau: string) => (clau in columnes ? fila[columnes[clau]] : null)
  const costat = (n: 1 | 2): EstadistiquesJugador => ({
    scrabbles: enter(cel(`scrabbles${n}`)),
    mot: normalitzaMot(cel(`mot${n}`)),
    puntsMot: enter(cel(`puntsMot${n}`)),
    motLletra: normalitzaMot(cel(`motLletra${n}`)),
    puntsLletra: enter(cel(`puntsLletra${n}`)),
  })
  const estadistiques = { jugador1: costat(1), jugador2: costat(2) }
  const buit = (e: EstadistiquesJugador) => Object.values(e).every((v) => v === null)
  return buit(estadistiques.jugador1) && buit(estadistiques.jugador2) ? null : estadistiques
}

/** Converteix les files crues d'un full en resultats, amb la capçalera a la primera. */
export function interpretaFiles(files: unknown[][]): FilaResultat[] {
  const sensebuides = files.filter((fila) => fila.some((c) => c !== null && String(c ?? '') !== ''))
  if (sensebuides.length < 2) {
    throw new ErrorFull('El full no té capçalera i almenys una fila de resultats')
  }

  const columnes = mapaColumnes(sensebuides[0])
  const resultats: FilaResultat[] = []

  sensebuides.slice(1).forEach((fila, index) => {
    const numeroFila = index + 2
    const jugador1 = netejaNom(String(fila[columnes.jugador1] ?? ''))
    if (jugador1 === '') return

    const jugador2Cru = netejaNom(String(fila[columnes.jugador2] ?? ''))
    const esBye = jugador2Cru === '' || PARAULES_BYE.has(normalitzaNom(jugador2Cru))

    const puntuacio1 = aNombre(fila[columnes.puntuacio1])
    if (puntuacio1 === null && !esBye) {
      throw new ErrorFull(`Fila ${numeroFila}: falta la puntuació de ${jugador1}`)
    }

    const puntuacio2 = esBye ? null : aNombre(fila[columnes.puntuacio2])
    if (!esBye && puntuacio2 === null) {
      throw new ErrorFull(`Fila ${numeroFila}: falta la puntuació de ${jugador2Cru}`)
    }

    const estadistiques = esBye ? null : estadistiquesDe(fila, columnes)
    resultats.push({
      fila: numeroFila,
      ronda: 'ronda' in columnes ? aNombre(fila[columnes.ronda]) : null,
      jugador1,
      puntuacio1: puntuacio1 ?? 1,
      jugador2: esBye ? null : jugador2Cru,
      puntuacio2,
      ...(estadistiques ? { estadistiques } : {}),
    })
  })

  if (resultats.length === 0) {
    throw new ErrorFull('El full no conté cap resultat')
  }

  return resultats
}

/**
 * Reparteix les partides en rondes de manera que cap jugador no en repeteixi
 * cap dins la mateixa.
 *
 * Es fa servir quan el full no porta columna de ronda. Per al BARRUF la ronda
 * és indiferent —només compta el conjunt de partides— però la base de dades no
 * admet que un jugador aparegui dues vegades a la mateixa ronda, i mostrar-les
 * agrupades va bé.
 */
function reparteixEnRondes(resultats: FilaResultat[]): number[] {
  const ocupacio: Set<string>[] = []

  return resultats.map((resultat) => {
    const implicats = [resultat.jugador1, resultat.jugador2]
      .filter((n): n is string => n !== null)
      .map(normalitzaNom)

    let ronda = 0
    while (
      ocupacio[ronda] !== undefined &&
      implicats.some((jugador) => ocupacio[ronda].has(jugador))
    ) {
      ronda++
    }
    ocupacio[ronda] ??= new Set<string>()
    for (const jugador of implicats) ocupacio[ronda].add(jugador)

    return ronda + 1
  })
}

/** Hi ha algun jugador amb més d'una partida en una mateixa ronda? */
function repeteixRonda(resultats: FilaResultat[], rondes: number[]): boolean {
  const vistos = new Set<string>()
  return resultats.some((resultat, index) =>
    [resultat.jugador1, resultat.jugador2]
      .filter((n): n is string => n !== null)
      .some((nom) => {
        const clau = `${rondes[index]}|${normalitzaNom(nom)}`
        if (vistos.has(clau)) return true
        vistos.add(clau)
        return false
      }),
  )
}

/**
 * Numera seguides les rondes d'un full que les repeteix per blocs.
 *
 * Quan es juguen dues partides per ronda, el full de l'AJUSC en posa les rondes
 * 1 a 5 i després, una altra vegada, 1 a 5. Cada cop que la numeració torna
 * enrere comença un bloc nou, que continua on acabava l'anterior: 1–5 i 6–10.
 */
function numeraPerBlocs(resultats: FilaResultat[]): number[] {
  let desplacament = 0
  let maximDelBloc = 0
  let anterior = 0
  return resultats.map((resultat) => {
    const ronda = resultat.ronda ?? 1
    if (ronda < anterior) {
      desplacament += maximDelBloc
      maximDelBloc = 0
    }
    anterior = ronda
    maximDelBloc = Math.max(maximDelBloc, ronda)
    return ronda + desplacament
  })
}

export interface TorneigDeFull extends Torneig {
  /** Les rondes s'han deduït perquè el full no en portava columna. */
  rondesDeduides: boolean
  /**
   * El full repetia les rondes per blocs (1–5 i 1–5) i s'han numerat seguides
   * (1–10). Passa quan es juguen dues partides per ronda.
   */
  rondesPerBlocs: boolean
  /** Les xifres eren puntuacions d'Scrabble i no resultats de partida. */
  ambPuntsScrabble: boolean
}

/** Construeix el torneig a partir dels resultats llegits. */
export function construeixTorneigDeFull(
  resultats: FilaResultat[],
  info?: { nom?: string; organitzador?: string },
): TorneigDeFull {
  const rondesDeduides = resultats.every((r) => r.ronda === null)
  const delFull = resultats.map((r) => r.ronda ?? 1)
  // Si amb les rondes del full algú en repeteix, potser és que van per blocs.
  // Si tampoc així quadren, es deixen com eren perquè l'error surti més avall.
  const perBlocs = rondesDeduides || !repeteixRonda(resultats, delFull) ? null : numeraPerBlocs(resultats)
  const rondesPerBlocs = perBlocs !== null && !repeteixRonda(resultats, perBlocs)
  const rondes = rondesDeduides
    ? reparteixEnRondes(resultats)
    : rondesPerBlocs
      ? perBlocs!
      : delFull

  // Número local per ordre d'aparició, només per lligar les partides.
  const identificadors = new Map<string, number>()
  const participants: ParticipantTorneig[] = []
  const identifica = (nom: string): number => {
    const clau = normalitzaNom(nom)
    const existent = identificadors.get(clau)
    if (existent !== undefined) return existent

    const id = participants.length + 1
    identificadors.set(clau, id)
    participants.push({
      id,
      numeroSortida: String(id),
      cognoms: '',
      nom: '',
      nomComplet: nom,
      club: '',
      federacio: '',
      puntuacioInicial: null,
      retiratDesDeLaRonda: null,
    })
    return id
  }

  let ambPuntsScrabble = false
  const partides: PartidaTorneig[] = []
  const rondesJugades = new Set<number>()

  resultats.forEach((resultat, index) => {
    const ronda = rondes[index]
    const blancId = identifica(resultat.jugador1)

    // Un descans no és una partida jugada: es registra el participant i prou.
    if (resultat.jugador2 === null) return

    const negreId = identifica(resultat.jugador2)
    if (blancId === negreId) {
      throw new ErrorFull(`Fila ${resultat.fila}: ${resultat.jugador1} juga contra si mateix`)
    }

    const { resultat: valor, sonPuntsScrabble } = interpretaResultat(
      resultat.puntuacio1,
      resultat.puntuacio2 ?? 0,
    )
    if (sonPuntsScrabble) ambPuntsScrabble = true

    rondesJugades.add(ronda)
    partides.push({
      ronda,
      blancId,
      negreId,
      resultatBlanc: valor,
      puntsBlanc: sonPuntsScrabble ? resultat.puntuacio1 : null,
      puntsNegre: sonPuntsScrabble ? (resultat.puntuacio2 ?? null) : null,
      estadistiques: resultat.estadistiques ?? null,
    })
  })

  // Amb el full no podem saber si una partida hi falta o no existeix.
  const perRonda = new Map<number, Set<number>>()
  for (const partida of partides) {
    const jugadors = perRonda.get(partida.ronda) ?? new Set<number>()
    for (const jugador of [partida.blancId, partida.negreId]) {
      if (jugadors.has(jugador)) {
        const nom = participants.find((p) => p.id === jugador)?.nomComplet ?? jugador
        throw new ErrorFull(`${nom} té més d'una partida a la ronda ${partida.ronda}`)
      }
      jugadors.add(jugador)
    }
    perRonda.set(partida.ronda, jugadors)
  }

  return {
    info: info?.nom
      ? {
          nom: info.nom,
          organitzador: info.organitzador ?? '',
          arbitre: '',
          rondesPrevistes: null,
        }
      : null,
    participants,
    partides,
    rondesJugades: [...rondesJugades].sort((a, b) => a - b),
    rondesPendents: [],
    rondesDeduides,
    rondesPerBlocs,
    ambPuntsScrabble,
  }
}
