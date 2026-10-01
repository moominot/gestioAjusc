import { describe, expect, it } from 'vitest'

import { canvis, etiqueta, frase } from './descripcio'

describe('registre de canvis', () => {
  it('resumeix quantes files de cada taula', () => {
    expect(frase({ taula: 'partides', operacio: 'INSERT', files: 90 })).toBe("S'han creat 90 partides")
    expect(frase({ taula: 'campionats', operacio: 'UPDATE', files: 1 })).toBe("S'ha modificat 1 campionat")
  })

  it('anomena la fila pel nom, o pel que la identifiqui', () => {
    expect(etiqueta({ taula: 'campionats', operacio: 'UPDATE', abans: null, despres: { nom: 'XII ManaCup' } })).toBe('XII ManaCup')
    expect(etiqueta({ taula: 'jugadors', operacio: 'DELETE', abans: { nom_complet: 'Bel Miquel' }, despres: null })).toBe('Bel Miquel')
    expect(etiqueta({ taula: 'partides', operacio: 'INSERT', abans: null, despres: { ronda: 3 } })).toBe('ronda 3')
  })

  it('dona només els camps que han canviat, sense els tècnics', () => {
    expect(
      canvis({
        taula: 'partides',
        operacio: 'UPDATE',
        abans: { id: 'x', punts_1: 400, punts_2: 380, resultat_1: 1, modificat_el: 'a' },
        despres: { id: 'x', punts_1: 380, punts_2: 400, resultat_1: 0, modificat_el: 'b' },
      }),
    ).toEqual([
      { camp: 'punts_1', abans: '400', despres: '380' },
      { camp: 'punts_2', abans: '380', despres: '400' },
      { camp: 'resultat_1', abans: '1', despres: '0' },
    ])
  })
})
