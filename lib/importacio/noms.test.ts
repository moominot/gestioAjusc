import { describe, expect, it } from 'vitest'

import { netejaNom, normalitzaNom } from './noms'

describe('netejaNom', () => {
  it('treu el WORD JOINER que porta la llista del BARRUF', () => {
    // Cas real: a DadesÚltimBarruf aquest nom comença amb U+2060.
    expect(netejaNom('⁠Bel Miquel Cazorla')).toBe('Bel Miquel Cazorla')
  })

  it('treu els espais de les vores i els duplicats', () => {
    // Cas real: a la llista hi ha diversos noms amb espai al davant.
    expect(netejaNom(' Àlex Castillo')).toBe('Àlex Castillo')
    expect(netejaNom('Joan  Andreu ')).toBe('Joan Andreu')
  })

  it('converteix els espais que no ho semblen en espais normals', () => {
    expect(netejaNom('Maria Gayà')).toBe('Maria Gayà')
    expect(netejaNom('Pere Riera')).toBe('Pere Riera')
  })

  it('no toca els accents ni les majúscules', () => {
    expect(netejaNom('Mateu Xurí')).toBe('Mateu Xurí')
    expect(netejaNom('Feriel Rabaï Ladària')).toBe('Feriel Rabaï Ladària')
  })
})

describe('normalitzaNom', () => {
  it('iguala les variants que són la mateixa persona', () => {
    expect(normalitzaNom('Mateu Xurí')).toBe(normalitzaNom('MATEU XURI'))
    expect(normalitzaNom('⁠Bel Miquel Cazorla')).toBe(normalitzaNom('Bel Miquel Cazorla'))
    expect(normalitzaNom('Joan Llodrà')).toBe(normalitzaNom(' joan  llodra '))
  })

  it('unifica el punt volat i els apòstrofs tipogràfics', () => {
    expect(normalitzaNom("Marcel·lí l'Hospitalet")).toBe(normalitzaNom("Marcelli l'Hospitalet"))
    expect(normalitzaNom('N’Alzamora')).toBe(normalitzaNom("N'Alzamora"))
  })

  it('no confon dues persones diferents', () => {
    expect(normalitzaNom('Lluís Fuster')).not.toBe(normalitzaNom('Lluís Fuster Amer'))
    expect(normalitzaNom('Carles Llull')).not.toBe(normalitzaNom('Bel Llull'))
  })

  it('és idempotent', () => {
    const un = normalitzaNom(' ⁠Antònia  Riera ')
    expect(normalitzaNom(un)).toBe(un)
  })
})
