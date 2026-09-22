/**
 * Resolució d'identitats: de les persones que surten a un fitxer de resultats
 * als jugadors del registre de l'AJUSC.
 *
 * És el punt delicat de tota la importació. Els resultats arriben de campionats
 * que l'AJUSC no organitza i cada organitzador escriu els noms com vol, mentre
 * que el BARRUF ha d'anar lligat a una identitat estable. Una resolució errònia
 * no dona cap error: simplement atribueix les partides a qui no toca i mou el
 * BARRUF de dues persones.
 *
 * Per això el mòdul només resol sol el que és segur —coincidència exacta de la
 * forma normalitzada, o d'un àlies ja validat— i tota la resta la deixa per a
 * una persona.
 */

import { normalitzaNom } from './noms'

export interface JugadorRegistre {
  /** Clau interna del registre. */
  id: string
  /** Número públic de jugador. */
  numero: number
  nomComplet: string
  /** BARRUF a l'última edició publicada. Serveix de corroboració. */
  barruf?: number | null
}

export interface AliesRegistre {
  jugadorId: string
  aliesNorm: string
}

export interface Candidat {
  jugador: JugadorRegistre
  semblanca: number
  /** El fitxer del torneig porta la mateixa puntuació que aquest jugador. */
  mateixaPuntuacio: boolean
  /**
   * A més, cap altre jugador del registre no té aquesta puntuació.
   *
   * És la pista més forta de què disposem per desfer una ambigüitat de nom, i
   * tot i així NO resol sola: el gestor ho ha de confirmar. Al ManaCup, «Lluís
   * Fuster» hi porta 1254 i l'únic jugador del registre amb 1254 és «Lluís
   * Fuster Amer».
   *
   * La puntuació per si sola no és cap clau d'identitat: al fitxer és la que
   * tenia el jugador quan es va muntar el torneig, i de 63 correspondències
   * segures del ManaCup només 23 la conserven igual.
   */
  unicAmbAquestaPuntuacio: boolean
}

export type Resolucio =
  | { tipus: 'exacte'; jugador: JugadorRegistre }
  | { tipus: 'alies'; jugador: JugadorRegistre }
  | { tipus: 'dubtos'; candidats: Candidat[] }
  | { tipus: 'nou'; candidats: Candidat[] }

export interface NomResolt<T> {
  origen: T
  nom: string
  nomNormalitzat: string
  resolucio: Resolucio
}

/**
 * Per sota d'aquesta semblança ni tan sols es proposa com a candidat: el nom és
 * prou diferent perquè suggerir-lo només faci nosa.
 */
export const LLINDAR_CANDIDAT = 0.55

/** Quants candidats es proposen com a màxim per a un nom dubtós. */
export const MAXIM_CANDIDATS = 5

/**
 * Distància de Levenshtein amb dues files, que és tot el que cal: aquí es
 * comparen noms de persona, no documents.
 */
export function distancia(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i)
  let actual = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i++) {
    actual[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      actual[j] = Math.min(anterior[j] + 1, actual[j - 1] + 1, anterior[j - 1] + cost)
    }
    ;[anterior, actual] = [actual, anterior]
  }

  return anterior[b.length]
}

/** Semblança entre 0 i 1 entre dues formes ja normalitzades. */
export function semblanca(a: string, b: string): number {
  const llarg = Math.max(a.length, b.length)
  return llarg === 0 ? 1 : 1 - distancia(a, b) / llarg
}

export interface Registre {
  jugadors: JugadorRegistre[]
  alies: AliesRegistre[]
}

/**
 * Resol una llista de noms contra el registre.
 *
 * L'ordre en què es mira és el que decideix la fiabilitat:
 *
 * 1. Coincidència exacta amb el nom del registre, un cop normalitzat.
 * 2. Coincidència amb un àlies ja validat per una persona en una importació
 *    anterior. És el que fa que el sistema aprengui: cada campionat importat
 *    en deixa de nous i el següent en demana menys.
 * 3. Si no, es proposen candidats ordenats per semblança perquè algú decideixi.
 *
 * Mai no es resol sol per semblança, per alta que sigui. «Lluís Fuster» i
 * «Lluís Fuster Amer» s'assemblen molt i poden ser dues persones.
 */
export function resolNoms<T>(
  entrades: { origen: T; nom: string; puntuacioInicial?: number | null }[],
  registre: Registre,
): NomResolt<T>[] {
  const perNom = new Map<string, JugadorRegistre>()
  for (const jugador of registre.jugadors) {
    perNom.set(normalitzaNom(jugador.nomComplet), jugador)
  }

  const perId = new Map(registre.jugadors.map((j) => [j.id, j]))
  const perAlies = new Map<string, JugadorRegistre>()
  for (const alies of registre.alies) {
    const jugador = perId.get(alies.jugadorId)
    if (jugador) perAlies.set(alies.aliesNorm, jugador)
  }

  // Quants jugadors del registre comparteixen cada puntuació.
  const quantsAmb = new Map<number, number>()
  for (const jugador of registre.jugadors) {
    if (typeof jugador.barruf === 'number') {
      quantsAmb.set(jugador.barruf, (quantsAmb.get(jugador.barruf) ?? 0) + 1)
    }
  }

  return entrades.map(({ origen, nom, puntuacioInicial }) => {
    const nomNormalitzat = normalitzaNom(nom)

    const exacte = perNom.get(nomNormalitzat)
    if (exacte) {
      return { origen, nom, nomNormalitzat, resolucio: { tipus: 'exacte', jugador: exacte } }
    }

    const perAliesValidat = perAlies.get(nomNormalitzat)
    if (perAliesValidat) {
      return {
        origen,
        nom,
        nomNormalitzat,
        resolucio: { tipus: 'alies', jugador: perAliesValidat },
      }
    }

    const candidats = registre.jugadors
      .map((jugador) => {
        const mateixaPuntuacio =
          typeof puntuacioInicial === 'number' && jugador.barruf === puntuacioInicial
        return {
          jugador,
          semblanca: semblanca(nomNormalitzat, normalitzaNom(jugador.nomComplet)),
          mateixaPuntuacio,
          unicAmbAquestaPuntuacio:
            mateixaPuntuacio && quantsAmb.get(puntuacioInicial as number) === 1,
        }
      })
      .filter((c) => c.semblanca >= LLINDAR_CANDIDAT)
      // Un candidat corroborat per la puntuació va davant encara que un altre
      // s'assembli una mica més de nom.
      .sort(
        (a, b) =>
          Number(b.unicAmbAquestaPuntuacio) - Number(a.unicAmbAquestaPuntuacio) ||
          Number(b.mateixaPuntuacio) - Number(a.mateixaPuntuacio) ||
          b.semblanca - a.semblanca,
      )
      .slice(0, MAXIM_CANDIDATS)

    return {
      origen,
      nom,
      nomNormalitzat,
      resolucio: candidats.length > 0 ? { tipus: 'dubtos', candidats } : { tipus: 'nou', candidats },
    }
  })
}

export interface ResumResolucio {
  total: number
  exactes: number
  perAlies: number
  dubtosos: number
  nous: number
  /** Noms que necessiten que algú decideixi abans de poder importar. */
  pendents: number
}

export function resumeix<T>(resolts: NomResolt<T>[]): ResumResolucio {
  const compte = (tipus: Resolucio['tipus']) =>
    resolts.filter((r) => r.resolucio.tipus === tipus).length

  const dubtosos = compte('dubtos')
  const nous = compte('nou')

  return {
    total: resolts.length,
    exactes: compte('exacte'),
    perAlies: compte('alies'),
    dubtosos,
    nous,
    pendents: dubtosos + nous,
  }
}
