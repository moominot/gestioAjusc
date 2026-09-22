import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { FilaClassificacio } from './swissperfect'
import {
  ErrorSwissPerfect,
  construeixCampionat,
  contrastaAmbClassificacio,
  dedueixRondesCobertes,
  llegeixClassificacio,
  llegeixRonda,
  puntuacionsPerJugador,
} from './swissperfect'

const DIRECTORI = join(__dirname, '__fixtures__', 'manacup')

/** Fitxers reals del ManaCup 2025-26, tal com els exporta el SwissPerfect. */
function fitxersRonda(): { ronda: number; contingut: string }[] {
  return readdirSync(DIRECTORI)
    .filter((nom) => nom.endsWith('.rnd'))
    .map((nom) => ({
      ronda: Number.parseInt(nom.match(/\.(\d+)\.rnd$/)![1], 10),
      contingut: readFileSync(join(DIRECTORI, nom), 'utf8'),
    }))
    .sort((a, b) => a.ronda - b.ronda)
}

const classificacio = () =>
  llegeixClassificacio(
    readFileSync(join(DIRECTORI, 'ManaCup_25-26.21.stg'), 'utf8'),
    'ManaCup_25-26.21.stg',
  )

const campionat = () => construeixCampionat(fitxersRonda().map((f) => f.contingut))

describe('llegeixRonda', () => {
  it('llegeix una ronda real', () => {
    const contingut = readFileSync(join(DIRECTORI, 'ManaCup_25-26.1.rnd'), 'utf8')
    const partides = llegeixRonda(contingut)

    expect(partides).toHaveLength(30)
    expect(partides[0]).toEqual({
      ronda: 1,
      taula: 1,
      blancId: 40,
      negreId: 43,
      resultatBlanc: 0,
    })
  })

  it('llegeix els empats', () => {
    const contingut = readFileSync(join(DIRECTORI, 'ManaCup_25-26.15.rnd'), 'utf8')
    const empats = llegeixRonda(contingut).filter((p) => p.resultatBlanc === 0.5)

    expect(empats).toHaveLength(1)
    expect(empats[0].blancId).toBe(8)
    expect(empats[0].negreId).toBe(11)
  })

  it('rebutja una capçalera que no reconeix', () => {
    expect(() => llegeixRonda('FOO|BAR\n1|2')).toThrow(ErrorSwissPerfect)
  })

  it('rebutja un resultat desconegut en comptes d’endevinar-lo', () => {
    const contingut = `ROUND|TABLE_NO|WHITE_ID|BLACK_ID|WHITE_SCORE|BLACK_SCORE\n1|1|1|2|+|-`
    expect(() => llegeixRonda(contingut)).toThrow(/resultat '\+' desconegut/)
  })

  it('rebutja resultats que no sumen 1', () => {
    const contingut = `ROUND|TABLE_NO|WHITE_ID|BLACK_ID|WHITE_SCORE|BLACK_SCORE\n1|1|1|2|1|1`
    expect(() => llegeixRonda(contingut)).toThrow(/no sumen 1/)
  })

  it('rebutja un jugador repetit dins la mateixa ronda', () => {
    const contingut =
      `ROUND|TABLE_NO|WHITE_ID|BLACK_ID|WHITE_SCORE|BLACK_SCORE\n` +
      `1|1|1|2|1|0\n1|2|1|3|1|0`
    expect(() => llegeixRonda(contingut)).toThrow(/ja té una partida a la ronda 1/)
  })

  it('rebutja un jugador contra si mateix', () => {
    const contingut = `ROUND|TABLE_NO|WHITE_ID|BLACK_ID|WHITE_SCORE|BLACK_SCORE\n1|1|5|5|1|0`
    expect(() => llegeixRonda(contingut)).toThrow(/contra si mateix/)
  })
})

describe('construeixCampionat', () => {
  it('ajunta les 15 rondes exportades del ManaCup', () => {
    const resultat = campionat()

    expect(resultat.rondes).toEqual([1, 2, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22])
    expect(resultat.partides).toHaveLength(450)
    expect(resultat.jugadors).toHaveLength(63)
  })

  it('avisa de les rondes que falten a l’exportació', () => {
    // De l'exportació rebuda hi manquen les rondes 3 a 9.
    expect(campionat().rondesQueFalten).toEqual([3, 4, 5, 6, 7, 8, 9])
  })

  it('no inventa cap BYE: qui descansa simplement no surt a la ronda', () => {
    const { partides } = campionat()
    // Cap identificador a zero ni cap partida amb un sol jugador.
    expect(partides.every((p) => p.blancId > 0 && p.negreId > 0)).toBe(true)
    // La ronda 1 té 30 taules i 65 inscrits: cinc no hi juguen.
    expect(partides.filter((p) => p.ronda === 1)).toHaveLength(30)
  })

  it('rebutja rondes repetides', () => {
    const una = readFileSync(join(DIRECTORI, 'ManaCup_25-26.1.rnd'), 'utf8')
    expect(() => construeixCampionat([una, una])).toThrow(/ronda repetida/)
  })
})

describe('puntuacionsPerJugador', () => {
  it('reparteix exactament un punt per partida', () => {
    const resultat = campionat()
    const total = [...puntuacionsPerJugador(resultat).values()].reduce((a, b) => a + b, 0)
    expect(total).toBe(resultat.partides.length)
  })
})

describe('llegeixClassificacio', () => {
  it('llegeix el fitxer .stg real', () => {
    const files = classificacio()

    expect(files).toHaveLength(65)
    expect(files[0]).toEqual({
      posicio: 1,
      posicioAgrupada: '1-5',
      jugadorId: 1,
      puntuacio: 17,
      victories: 17,
      medianBuchholz: 191.5,
      buchholz: 210.5,
      berger: 142,
    })
  })

  it('recull els jugadors inscrits que no han jugat mai', () => {
    const senseJugar = classificacio().filter((f) => f.puntuacio === 0 && f.victories === 0)
    expect(senseJugar.map((f) => f.jugadorId).sort((a, b) => a - b)).toEqual([
      7, 58, 60, 63, 64, 65,
    ])
  })

  it('els mitjos punts es corresponen amb els empats de les rondes', () => {
    // Quatre jugadors amb mig punt a la classificació: exactament els dos
    // empats que hi ha a les rondes 15 i 19.
    const ambMigPunt = classificacio().filter((f) => f.puntuacio !== f.victories)
    expect(ambMigPunt.map((f) => f.jugadorId).sort((a, b) => a - b)).toEqual([8, 11, 16, 49])
  })
})

describe('dedueixRondesCobertes', () => {
  /**
   * El número del nom del fitxer menteix. `ManaCup_25-26.21.stg` conté la
   * classificació després de 19 rondes: 570 punts repartits entre taules de
   * 30 en donen 19, no 21. Per això el nom del fitxer no s'ha de creure mai.
   */
  it('dedueix 19 rondes d’un fitxer que es diu 21', () => {
    expect(dedueixRondesCobertes(classificacio(), 30)).toBe(19)
  })

  it('retorna null si el total no quadra amb rondes senceres', () => {
    const trencada = [{ ...classificacio()[0], puntuacio: 0.25 }]
    expect(dedueixRondesCobertes(trencada, 30)).toBeNull()
  })
})

describe('contrastaAmbClassificacio', () => {
  it('no troba cap discrepància amb les 19 rondes que cobreix de debò', () => {
    expect(contrastaAmbClassificacio(campionat(), classificacio(), 19)).toEqual([])
  })

  it('detecta el desquadrament si ens creiem el número del nom del fitxer', () => {
    // Amb 21, les rondes 20 i 21 aporten punts que la classificació encara no
    // recull, i vuit jugadors queden per damunt del seu total.
    const discrepancies = contrastaAmbClassificacio(campionat(), classificacio(), 21)
    expect(discrepancies).toHaveLength(8)
    expect(discrepancies[0].motiu).toMatch(/més punts dels que consten/)
  })

  /**
   * Un campionat complet fet amb dades reals: agafem les rondes 10 a 19, que
   * són un tram seguit, i les renumerem d'1 a 10. Cal renumerar perquè les
   * classificacions del SwissPerfect sempre són acumulades des de la ronda 1.
   */
  const campionatComplet = () => {
    const base = construeixCampionat(
      fitxersRonda()
        .filter((f) => f.ronda >= 10 && f.ronda <= 19)
        .map((f) => f.contingut),
    )
    return {
      ...base,
      rondes: base.rondes.map((r) => r - 9),
      rondesQueFalten: [],
      partides: base.partides.map((p) => ({ ...p, ronda: p.ronda - 9 })),
    }
  }

  /** Classificació coherent amb un campionat, per provar el contrast. */
  const classificacioDe = (base: ReturnType<typeof campionatComplet>): FilaClassificacio[] =>
    [...puntuacionsPerJugador(base).entries()].map(([jugadorId, puntuacio], index) => ({
      posicio: index + 1,
      posicioAgrupada: '',
      jugadorId,
      puntuacio,
      victories: Math.floor(puntuacio),
      medianBuchholz: 0,
      buchholz: 0,
      berger: 0,
    }))

  const capgira = (base: ReturnType<typeof campionatComplet>) => ({
    ...base,
    partides: base.partides.map((p) =>
      p.ronda === 1 && p.taula === 1 ? { ...p, resultatBlanc: 0 as const } : p,
    ),
  })

  it('amb l’exportació completa detecta qualsevol resultat capgirat', () => {
    const base = campionatComplet()
    const esperada = classificacioDe(base)

    expect(contrastaAmbClassificacio(base, esperada, 10)).toEqual([])

    // La primera ronda, taula 1: 16 guanya a 31. Si es capgira, tots dos ballen.
    const discrepancies = contrastaAmbClassificacio(capgira(base), esperada, 10)
    expect(discrepancies.map((d) => d.jugadorId).sort((a, b) => a - b)).toEqual([16, 31])
  })

  /**
   * Limitació que cal tenir present: el contrast compara totals, i quan falten
   * rondes la tolerància és d'un punt per ronda absent. Amb les 7 rondes que
   * falten al ManaCup, un únic resultat capgirat cau dins del marge i passa
   * desapercebut. El contrast serveix per enxampar desquadraments grossos, no
   * per auditar resultat a resultat: per a això cal l'exportació sencera.
   */
  it('amb rondes absents, un sol resultat capgirat s’escapa del marge', () => {
    const original = campionat()
    const manipulat = {
      ...original,
      partides: original.partides.map((p) =>
        p.ronda === 1 && p.taula === 1 ? { ...p, resultatBlanc: 1 as const } : p,
      ),
    }
    expect(contrastaAmbClassificacio(manipulat, classificacio(), 19)).toEqual([])
  })
})
