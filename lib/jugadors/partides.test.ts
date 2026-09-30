import { describe, expect, it } from 'vitest'

import type { FilaEnfrontament } from '../supabase/tipus'
import { filtra, perRival, resumeix } from './partides'

const p = (
  rival: [number, string],
  resultat: number,
  punts: [number, number] | null,
  temporada = '2025-26',
  campionat = 'c1',
): FilaEnfrontament => ({
  jugador_numero: 1,
  rival_numero: rival[0],
  rival: rival[1],
  campionat_id: campionat,
  campionat: campionat,
  data: '2026-01-01',
  ronda: 1,
  resultat: String(resultat),
  punts: punts?.[0] ?? null,
  punts_rival: punts?.[1] ?? null,
  temporada_codi: temporada,
})

const ANNA: [number, string] = [2, 'Anna']
const BERTA: [number, string] = [3, 'Berta']

const partides = [
  p(ANNA, 1, [500, 400]),
  p(ANNA, 0, [350, 420]),
  p(BERTA, 0.5, [400, 400], '2024-25', 'c0'),
  p(BERTA, 1, null, '2024-25', 'c0'),
  p(ANNA, 1, [610, 300], '2024-25', 'c0'),
]

describe('filtra', () => {
  it('combina rival, temporada i campionat', () => {
    expect(filtra(partides, { rival: 2, temporada: null, campionat: null })).toHaveLength(3)
    expect(filtra(partides, { rival: 2, temporada: '2024-25', campionat: null })).toHaveLength(1)
    expect(filtra(partides, { rival: null, temporada: null, campionat: 'c1' })).toHaveLength(2)
  })
})

describe('resumeix', () => {
  it('compta victòries, empats i derrotes, i fa les mitjanes només amb les que tenen punts', () => {
    const r = resumeix(partides)
    expect([r.victories, r.empats, r.derrotes]).toEqual([3, 1, 1])
    expect(r.percentatge).toBeCloseTo(3.5 / 5)
    expect(r.ambPunts).toBe(4)
    expect(r.mitjanaFavor).toBe((500 + 350 + 400 + 610) / 4)
    expect(r.millor?.punts).toBe(610)
    expect(r.victoriaMesAmplia?.punts).toBe(610)
  })

  it('sense partides no divideix per zero', () => {
    expect(resumeix([])).toMatchObject({ partides: 0, percentatge: null, mitjanaFavor: null })
  })
})

it('perRival ordena pels més jugats', () => {
  expect(perRival(partides).map((r) => [r.nom, r.partides, r.victories])).toEqual([
    ['Anna', 3, 2],
    ['Berta', 2, 1.5],
  ])
})
