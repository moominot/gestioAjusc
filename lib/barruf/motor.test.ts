import { describe, expect, it } from 'vitest'

import { BARRUF_INICIAL, K_NOVELL, K_VETERA, SIGMA } from './constants'
import { calculaEstat } from './estats'
import {
  aplicaCampionat,
  calculaCampionat,
  esperancaPartida,
  estatInicial,
  factorK,
  rejugaCadena,
} from './motor'
import { normalCDF } from './normal'
import type { CampionatEntrada, EstatBarruf } from './tipus'

import estatsReals from './__fixtures__/estats-reals.json'

const mapa = (estats: EstatBarruf[]) => new Map(estats.map((e) => [e.jugadorId, e]))

const jugador = (id: string, barruf: number, partidesTotals = 0): EstatBarruf => ({
  ...estatInicial(id),
  barruf,
  partidesTotals,
})

describe('normalCDF', () => {
  it('val 0,5 al centre', () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 15)
  })

  it('coincideix amb valors de referència de la normal estàndard', () => {
    // Valors de NORMSDIST, contrastables amb qualsevol taula estadística.
    expect(normalCDF(1)).toBeCloseTo(0.841344746068543, 12)
    expect(normalCDF(-1)).toBeCloseTo(0.158655253931457, 12)
    expect(normalCDF(1.96)).toBeCloseTo(0.975002104852051, 12)
    expect(normalCDF(-2.5)).toBeCloseTo(0.006209665325776, 12)
    expect(normalCDF(3)).toBeCloseTo(0.998650101968370, 12)
  })

  it('és simètrica', () => {
    for (const z of [0.3, 1.1, 2.7, 5.2, 8.4]) {
      expect(normalCDF(z) + normalCDF(-z)).toBeCloseTo(1, 14)
    }
  })

  it('se satura als extrems sense petar', () => {
    expect(normalCDF(-50)).toBe(0)
    expect(normalCDF(50)).toBe(1)
  })
})

describe('esperancaPartida', () => {
  it('dona mig punt entre iguals', () => {
    expect(esperancaPartida(1200, 1200)).toBeCloseTo(0.5, 15)
  })

  it("creix amb l'avantatge i les dues bandes sumen 1", () => {
    const favorit = esperancaPartida(1300, 1100)
    expect(favorit).toBeGreaterThan(0.5)
    expect(favorit + esperancaPartida(1100, 1300)).toBeCloseTo(1, 14)
  })

  it('una diferència igual a sigma val una desviació típica', () => {
    expect(esperancaPartida(1000 + SIGMA, 1000)).toBeCloseTo(normalCDF(1), 15)
  })
})

describe('factorK', () => {
  it('val 30 fins a 50 partides acumulades', () => {
    expect(factorK(0, 0)).toBe(K_NOVELL)
    expect(factorK(45, 5)).toBe(K_NOVELL)
  })

  it('baixa a 20 en superar les 50', () => {
    expect(factorK(45, 6)).toBe(K_VETERA)
    expect(factorK(700, 3)).toBe(K_VETERA)
  })

  it('el llindar es pot creuar dins del mateix campionat', () => {
    // 48 prèvies + 3 del torneig = 51 > 50.
    expect(factorK(48, 3)).toBe(K_VETERA)
    expect(factorK(48, 2)).toBe(K_NOVELL)
  })
})

describe('calculaCampionat', () => {
  /**
   * Cas real, transcrit de les cel·les en memòria de `DadesTorneig` (files 25,
   * 40, 56 i 68 del GENERADOR_BARRUF). Quatre jugadors nous, tots a 950, i
   * quatre partides. Amb tothom igualat cada esperança val exactament 0,5, cosa
   * que fa que les xifres del full es puguin comprovar a mà.
   *
   *   Cristina  3 partides  0 vict.  esp. 1,5  K 30  →  −45
   *   Jordi     0 partides                            →  (sense variació)
   *   Mary      3 partides  2 vict.  esp. 1,5  K 30  →  +15
   *   Toni      2 partides  2 vict.  esp. 1,0  K 30  →  +30
   */
  const campionatDelFull: CampionatEntrada = {
    id: 'manacup',
    temporadaCodi: '2025-26',
    inscrits: ['cristina', 'jordi', 'mary', 'toni'],
    partides: [
      { ronda: 1, jugador1Id: 'cristina', jugador2Id: 'toni', resultat1: 0 },
      { ronda: 2, jugador1Id: 'cristina', jugador2Id: 'mary', resultat1: 0 },
      { ronda: 3, jugador1Id: 'cristina', jugador2Id: 'mary', resultat1: 0 },
      { ronda: 4, jugador1Id: 'mary', jugador2Id: 'toni', resultat1: 0 },
    ],
  }

  it('reprodueix les xifres del full de càlcul', () => {
    const variacions = calculaCampionat(campionatDelFull, new Map())
    const per = Object.fromEntries(variacions.map((v) => [v.jugadorId, v]))

    expect(per.cristina.partides).toBe(3)
    expect(per.cristina.victories).toBe(0)
    expect(per.cristina.esperanca).toBeCloseTo(1.5, 12)
    expect(per.cristina.factorK).toBe(30)
    expect(per.cristina.variacio).toBeCloseTo(-45, 10)

    expect(per.mary.partides).toBe(3)
    expect(per.mary.victories).toBe(2)
    expect(per.mary.esperanca).toBeCloseTo(1.5, 12)
    expect(per.mary.factorK).toBe(30)
    expect(per.mary.variacio).toBeCloseTo(15, 10)

    expect(per.toni.partides).toBe(2)
    expect(per.toni.victories).toBe(2)
    expect(per.toni.esperanca).toBeCloseTo(1, 12)
    expect(per.toni.factorK).toBe(30)
    expect(per.toni.variacio).toBeCloseTo(30, 10)
  })

  it('el conjunt del campionat suma zero', () => {
    const suma = calculaCampionat(campionatDelFull, new Map()).reduce(
      (total, v) => total + v.variacio,
      0,
    )
    expect(suma).toBeCloseTo(0, 10)
  })

  it("no dona variació a qui s'inscriu i no juga", () => {
    const variacions = calculaCampionat(campionatDelFull, new Map())
    expect(variacions.find((v) => v.jugadorId === 'jordi')).toBeUndefined()
  })

  it('parteix de 950 els jugadors desconeguts', () => {
    const [variacio] = calculaCampionat(campionatDelFull, new Map())
    expect(variacio.barrufAbans).toBe(BARRUF_INICIAL)
  })

  it('tracta un BARRUF de zero com a jugador nou, igual que el full', () => {
    const previ = mapa([jugador('cristina', 0)])
    const [variacio] = calculaCampionat(campionatDelFull, previ)
    expect(variacio.barrufAbans).toBe(BARRUF_INICIAL)
  })

  it('el joc és de suma zero quan tots tenen el mateix factor K', () => {
    const previ = mapa([
      jugador('a', 1300),
      jugador('b', 1100),
      jugador('c', 950),
    ])
    const campionat: CampionatEntrada = {
      id: 'c1',
      temporadaCodi: '2025-26',
      inscrits: ['a', 'b', 'c'],
      partides: [
        { ronda: 1, jugador1Id: 'a', jugador2Id: 'b', resultat1: 1 },
        { ronda: 2, jugador1Id: 'a', jugador2Id: 'c', resultat1: 0 },
        { ronda: 3, jugador1Id: 'b', jugador2Id: 'c', resultat1: 0.5 },
      ],
    }
    const suma = calculaCampionat(campionat, previ).reduce((t, v) => t + v.variacio, 0)
    expect(suma).toBeCloseTo(0, 10)
  })

  it('guanyar contra un favorit puja més que guanyar contra un feble', () => {
    const previ = mapa([jugador('jo', 1200), jugador('fort', 1500), jugador('feble', 900)])
    const contra = (adversari: string) =>
      calculaCampionat(
        {
          id: 'x',
          temporadaCodi: '2025-26',
          inscrits: ['jo', adversari],
          partides: [{ ronda: 1, jugador1Id: 'jo', jugador2Id: adversari, resultat1: 1 }],
        },
        previ,
      )[0].variacio

    expect(contra('fort')).toBeGreaterThan(contra('feble'))
  })

  it('un BYE no compta com a partida jugada', () => {
    const campionat: CampionatEntrada = {
      id: 'ambBye',
      temporadaCodi: '2025-26',
      inscrits: ['a', 'b'],
      partides: [
        { ronda: 1, jugador1Id: 'a', jugador2Id: null, resultat1: 1 },
        { ronda: 2, jugador1Id: 'a', jugador2Id: 'b', resultat1: 1 },
      ],
    }
    const variacions = calculaCampionat(campionat, new Map())
    expect(variacions.find((v) => v.jugadorId === 'a')!.partides).toBe(1)
  })

  it("calcula totes les esperances amb els BARRUF d'abans del campionat", () => {
    // Si el motor actualitzés a mitja competició, la segona partida de 'a'
    // faria servir un BARRUF ja mogut i les dues bandes deixarien de sumar 1.
    const previ = mapa([jugador('a', 1000), jugador('b', 1400)])
    const campionat: CampionatEntrada = {
      id: 'c',
      temporadaCodi: '2025-26',
      inscrits: ['a', 'b'],
      partides: [
        { ronda: 1, jugador1Id: 'a', jugador2Id: 'b', resultat1: 1 },
        { ronda: 2, jugador1Id: 'a', jugador2Id: 'b', resultat1: 1 },
      ],
    }
    const variacions = calculaCampionat(campionat, previ)
    const a = variacions.find((v) => v.jugadorId === 'a')!
    const b = variacions.find((v) => v.jugadorId === 'b')!
    expect(a.esperanca + b.esperanca).toBeCloseTo(2, 12)
  })
})

describe('aplicaCampionat', () => {
  const campionat: CampionatEntrada = {
    id: 'c',
    temporadaCodi: '2025-26',
    inscrits: ['a', 'b'],
    partides: [{ ronda: 1, jugador1Id: 'a', jugador2Id: 'b', resultat1: 1 }],
  }

  it('acumula partides i victòries', () => {
    const previ = mapa([jugador('a', 1000, 12), jugador('b', 1000, 30)])
    const seguent = aplicaCampionat(campionat, previ, calculaCampionat(campionat, previ))

    expect(seguent.get('a')!.partidesTotals).toBe(13)
    expect(seguent.get('a')!.victoriesTotals).toBe(1)
    expect(seguent.get('b')!.partidesTotals).toBe(31)
    expect(seguent.get('b')!.victoriesTotals).toBe(0)
  })

  it('no modifica el mapa rebut', () => {
    const previ = mapa([jugador('a', 1000), jugador('b', 1000)])
    aplicaCampionat(campionat, previ, calculaCampionat(campionat, previ))
    expect(previ.get('a')!.barruf).toBe(1000)
    expect(previ.get('a')!.partidesTotals).toBe(0)
  })

  it('reinicia els comptadors en canviar de temporada', () => {
    const previ = new Map<string, EstatBarruf>([
      [
        'a',
        {
          ...jugador('a', 1000, 20),
          partidesTemporada: 8,
          victoriesTemporada: 5,
          darreraTemporada: '2024-25',
        },
      ],
      ['b', jugador('b', 1000, 20)],
    ])
    const seguent = aplicaCampionat(campionat, previ, calculaCampionat(campionat, previ))

    expect(seguent.get('a')!.partidesTemporada).toBe(1)
    expect(seguent.get('a')!.victoriesTemporada).toBe(1)
    expect(seguent.get('a')!.partidesTotals).toBe(21)
  })

  it('acumula dins de la mateixa temporada', () => {
    const previ = new Map<string, EstatBarruf>([
      [
        'a',
        {
          ...jugador('a', 1000, 20),
          partidesTemporada: 8,
          victoriesTemporada: 5,
          darreraTemporada: '2025-26',
        },
      ],
      ['b', jugador('b', 1000, 20)],
    ])
    const seguent = aplicaCampionat(campionat, previ, calculaCampionat(campionat, previ))
    expect(seguent.get('a')!.partidesTemporada).toBe(9)
    expect(seguent.get('a')!.victoriesTemporada).toBe(6)
  })
})

describe('rejugaCadena', () => {
  const campionats: CampionatEntrada[] = [
    {
      id: 'c1',
      temporadaCodi: '2025-26',
      inscrits: ['a', 'b'],
      partides: [{ ronda: 1, jugador1Id: 'a', jugador2Id: 'b', resultat1: 1 }],
    },
    {
      id: 'c2',
      temporadaCodi: '2025-26',
      inscrits: ['a', 'b'],
      partides: [{ ronda: 1, jugador1Id: 'a', jugador2Id: 'b', resultat1: 0 }],
    },
  ]

  it('és determinista: dues execucions donen el mateix', () => {
    const llavor = mapa([jugador('a', 1000, 60), jugador('b', 1200, 60)])
    const primera = rejugaCadena(llavor, campionats).estatFinal
    const segona = rejugaCadena(llavor, campionats).estatFinal

    expect(segona.get('a')!.barruf).toBe(primera.get('a')!.barruf)
    expect(segona.get('b')!.barruf).toBe(primera.get('b')!.barruf)
  })

  it("l'ordre dels campionats altera el resultat", () => {
    // Amb K constant l'ordre seria indiferent, però en creuar el llindar de les
    // 50 partides el factor canvia, i llavors l'ordre sí que compta. Per això
    // la cadena necessita un ordre total i determinista.
    const llavor = mapa([jugador('a', 1000, 48), jugador('b', 1200, 48)])
    const endavant = rejugaCadena(llavor, campionats).estatFinal.get('a')!.barruf
    const enrere = rejugaCadena(llavor, [...campionats].reverse()).estatFinal.get('a')!.barruf

    expect(endavant).not.toBeCloseTo(enrere, 6)
  })

  it('no deixa rastre dels campionats a la llavor', () => {
    const llavor = mapa([jugador('a', 1000), jugador('b', 1200)])
    rejugaCadena(llavor, campionats)
    expect(llavor.get('a')!.barruf).toBe(1000)
  })

  it('guarda el detall auditable de cada campionat', () => {
    const llavor = mapa([jugador('a', 1000), jugador('b', 1200)])
    const { variacionsPerCampionat } = rejugaCadena(llavor, campionats)

    expect([...variacionsPerCampionat.keys()]).toEqual(['c1', 'c2'])
    const [primera] = variacionsPerCampionat.get('c1')!
    expect(primera.barrufAbans + primera.variacio).toBeCloseTo(primera.barrufDespres, 10)
  })

  it('encadena: el BARRUF de sortida de l’un és el d’entrada del següent', () => {
    const llavor = mapa([jugador('a', 1000), jugador('b', 1200)])
    const { variacionsPerCampionat, estatFinal } = rejugaCadena(llavor, campionats)

    const c1 = variacionsPerCampionat.get('c1')!.find((v) => v.jugadorId === 'a')!
    const c2 = variacionsPerCampionat.get('c2')!.find((v) => v.jugadorId === 'a')!

    expect(c2.barrufAbans).toBeCloseTo(c1.barrufDespres, 12)
    expect(estatFinal.get('a')!.barruf).toBeCloseTo(c2.barrufDespres, 12)
  })
})

describe('calculaEstat', () => {
  it('reprodueix els 609 jugadors del full de càlcul', () => {
    const { temporadaActual, jugadors } = estatsReals as {
      temporadaActual: string
      jugadors: {
        nom: string
        partidesTotals: number
        darreraTemporada: string | null
        cohortLlegat: boolean
        estat: string
      }[]
    }

    const fallades = jugadors.filter(
      (j) =>
        calculaEstat({
          partidesTotals: j.partidesTotals,
          darreraTemporada: j.darreraTemporada,
          cohortLlegat: j.cohortLlegat,
          temporadaActual,
        }) !== j.estat,
    )

    expect(fallades).toEqual([])
    expect(jugadors).toHaveLength(609)
  })

  const base = { temporadaActual: '2025-26', darreraTemporada: '2025-26' }

  it("és 'nov' qui no ha jugat mai", () => {
    expect(calculaEstat({ ...base, partidesTotals: 0, darreraTemporada: null })).toBe('nov')
  })

  it("és 'exp' amb 10 partides o menys", () => {
    expect(calculaEstat({ ...base, partidesTotals: 1 })).toBe('exp')
    expect(calculaEstat({ ...base, partidesTotals: 10 })).toBe('exp')
  })

  it("és 'act' a partir d'11 partides jugant sovint", () => {
    expect(calculaEstat({ ...base, partidesTotals: 11 })).toBe('act')
  })

  it("l'expectativa no caduca mai encara que faci anys que no jugui", () => {
    expect(
      calculaEstat({ ...base, partidesTotals: 6, darreraTemporada: '2014-15' }),
    ).toBe('exp')
  })

  it('desactiva després de dues temporades senceres sense jugar', () => {
    expect(
      calculaEstat({ ...base, partidesTotals: 100, darreraTemporada: '2023-24' }),
    ).toBe('act')
    expect(
      calculaEstat({ ...base, partidesTotals: 100, darreraTemporada: '2022-23' }),
    ).toBe('inact')
  })

  it('desactiva el cohort de llegat sigui quin sigui el bagatge', () => {
    expect(
      calculaEstat({ ...base, partidesTotals: 500, cohortLlegat: true, darreraTemporada: null }),
    ).toBe('inact')
    expect(
      calculaEstat({ ...base, partidesTotals: 3, cohortLlegat: true, darreraTemporada: null }),
    ).toBe('inact')
  })
})
