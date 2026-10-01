import { describe, expect, it } from 'vitest'

import { efecte, probabilitat, torneig, type Contendent } from './prediccio'

const j = (numero: number, barruf: number | null, partidesTotals = 200): Contendent => ({ numero, barruf, partidesTotals })

describe('prediccions', () => {
  it('dona el 50 % entre iguals i és simètrica', () => {
    expect(probabilitat(j(1, 1200), j(2, 1200))).toBeCloseTo(0.5, 10)
    const ab = probabilitat(j(1, 1400), j(2, 1100))
    expect(ab + probabilitat(j(2, 1100), j(1, 1400))).toBeCloseTo(1, 10)
    // 300 punts de diferència són poc més d'una σ (283,84): ~85 %.
    expect(ab).toBeGreaterThan(0.85)
    expect(ab).toBeLessThan(0.86)
  })

  it('fa servir el BARRUF de sortida per a qui no en té', () => {
    expect(probabilitat(j(1, null), j(2, 950))).toBeCloseTo(0.5, 10)
  })

  it('calcula què guanya i què perd cadascú, amb la K que toca', () => {
    // Iguals i veterans (K = 20): +10 si guanya, −10 si perd.
    expect(efecte(j(1, 1200), j(2, 1200))).toEqual({ guanya: 10, empata: 0, perd: -10 })
    // Un novell (K = 30) guanya més.
    expect(efecte(j(1, 1200, 5), j(2, 1200)).guanya).toBe(15)
  })

  it('simula un torneig: les esperades sumen les partides i les probabilitats, 1', () => {
    const r = torneig([j(1, 1400), j(2, 1200), j(3, 1000)], 4000)
    expect(r.reduce((s, x) => s + x.esperades, 0)).toBeCloseTo(3, 10)
    expect(r.reduce((s, x) => s + x.primer, 0)).toBeCloseTo(1, 10)
    expect(r[0].primer).toBeGreaterThan(r[1].primer)
    expect(r[1].primer).toBeGreaterThan(r[2].primer)
    // Amb la mateixa llavor, el mateix resultat.
    expect(torneig([j(1, 1400), j(2, 1200), j(3, 1000)], 4000)).toEqual(r)
  })
})
