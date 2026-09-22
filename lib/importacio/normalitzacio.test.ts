import { describe, expect, it } from 'vitest'

import { normalitzaNom } from './noms'

import casos from './__fixtures__/normalitzacio.json'

/**
 * La normalització de noms existeix dues vegades: aquí en TypeScript i a la
 * base de dades, a `normalitza_nom()`, perquè els àlies els escriu el SQL.
 *
 * Si divergeixen, un nom que el codi considera conegut la base de dades el
 * desaria com a àlies nou, i a l'inrevés: la importació demanaria validar cada
 * vegada jugadors que ja hi consten. Aquesta prova ho impedeix.
 *
 * El fitxer de casos el genera el mateix SQL sobre els 609 noms del registre,
 * més uns quants casos difícils. Per regenerar-lo:
 *
 *   psql -c "SELECT ... normalitza_nom(nom) ..." > __fixtures__/normalitzacio.json
 */
describe('la normalització de TypeScript i la de SQL coincideixen', () => {
  const { casos: files } = casos as { casos: { nom: string; normalitzat: string }[] }

  it('cobreix tot el registre i uns quants casos difícils', () => {
    expect(files.length).toBeGreaterThan(600)
  })

  it('dona el mateix resultat en tots els casos', () => {
    const divergencies = files
      .filter((cas) => normalitzaNom(cas.nom) !== cas.normalitzat)
      .map((cas) => ({ nom: cas.nom, sql: cas.normalitzat, typescript: normalitzaNom(cas.nom) }))

    expect(divergencies).toEqual([])
  })
})
