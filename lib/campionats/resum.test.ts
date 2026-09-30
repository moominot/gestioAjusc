import { describe, expect, it } from 'vitest'

import { resumeix, type CampionatResum } from './resum'

const camp = (id: string, extra: Partial<CampionatResum>): CampionatResum => ({
  id,
  nom: `Campionat ${id}`,
  temporada_codi: '2025-26',
  club_organitzador: 'Manacor',
  organitzador: null,
  participants: 10,
  partides: 30,
  rondes_jugades: 6,
  ...extra,
})

describe('resumeix', () => {
  const llista = [
    camp('a', { participants: 60, partides: 780, rondes_jugades: 26 }),
    camp('b', { participants: 20, partides: 60, club_organitzador: 'Badalona', temporada_codi: '2024-25' }),
    camp('c', { participants: 10, partides: 30 }),
  ]

  it('suma i fa mitjanes', () => {
    const r = resumeix(llista)
    expect(r.campionats).toBe(3)
    expect(r.partides).toBe(870)
    expect(r.participacions).toBe(90)
    expect(r.mitjanaJugadors).toBe(30)
    expect(r.jugadors).toBeNull()
  })

  it('destaca el campionat més gran, l’organitzador i la temporada', () => {
    const r = resumeix(llista)
    expect(r.mesJugadors).toEqual({ id: 'a', nom: 'Campionat a', valor: 60 })
    expect(r.mesRondes?.valor).toBe(26)
    expect(r.organitzador).toEqual({ nom: 'Manacor', valor: 2 })
    expect(r.temporada).toEqual({ nom: '2025-26', valor: 2 })
  })

  it('compta persones diferents i qui ha jugat més campionats', () => {
    const r = resumeix(llista, { a: [1, 2, 3], b: [2, 3], c: [3] }, { 3: 'Mateu Xurí' })
    expect(r.jugadors).toBe(3)
    expect(r.jugadorMesCampionats).toEqual({ numero: 3, nom: 'Mateu Xurí', valor: 3 })
  })

  it('amb una sola temporada no en destaca cap', () => {
    expect(resumeix([llista[0], llista[2]]).temporada).toBeNull()
  })
})
