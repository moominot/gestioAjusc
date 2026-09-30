import { describe, expect, it } from 'vitest'

import { trobaDuplicats, type JugadorDades } from './duplicats'

let seguent = 1
const jugador = (nom: string, extra: Partial<JugadorDades> = {}): JugadorDades => ({
  numero: seguent++,
  nom,
  club: null,
  partides: 10,
  primera: '2018-19',
  darrera: '2019-20',
  campionats: [],
  ...extra,
})

describe('trobaDuplicats', () => {
  it('troba noms escrits de manera diferent', () => {
    const [p] = trobaDuplicats([jugador('Margalida Bonnín'), jugador('Margalida Bonnnin')])
    expect(p.motius).toContain('noms semblants')
  })

  it('troba un nom que és dins l’altre i les inicials', () => {
    const parelles = trobaDuplicats([
      jugador('Pere Grimalt'),
      jugador('Pere Grimalt Vert'),
      jugador('Joan R. Manchado'),
      jugador('Joan Ramon Manchado'),
    ])
    const motius = parelles.map((p) => [p.a.nom, p.b.nom, p.motius].flat().join('|'))
    expect(motius.some((m) => m.includes('Pere Grimalt') && m.includes('un nom dins l’altre'))).toBe(true)
    expect(motius.some((m) => m.includes('Manchado') && m.includes('inicials'))).toBe(true)
  })

  it('no proposa noms que només comparteixen el cognom', () => {
    expect(trobaDuplicats([jugador('Maria Riera'), jugador('Antoni Riera')])).toEqual([])
  })

  it('descarta qui ha coincidit en un campionat: són dues persones', () => {
    expect(
      trobaDuplicats([
        jugador('Lluís Fuster', { campionats: ['c1', 'c2'] }),
        jugador('Lluís Fuster Amer', { campionats: ['c2'] }),
      ]),
    ).toEqual([])
  })

  it('respecta les parelles descartades', () => {
    const a = jugador('Anna Genís')
    const b = jugador('Anna Genis')
    expect(trobaDuplicats([a, b], [[b.numero, a.numero]])).toEqual([])
  })

  it('posa primer qui té més partides i valora que un plegui quan l’altre comença', () => {
    const [p] = trobaDuplicats([
      jugador('Lina Riera', { partides: 8, primera: '2014-15', darrera: '2015-16' }),
      jugador('Lina Maria Riera', { partides: 300, primera: '2016-17', darrera: '2025-26' }),
    ])
    expect(p.a.nom).toBe('Lina Maria Riera')
    expect(p.periodesSeparats).toBe(true)
  })
})
