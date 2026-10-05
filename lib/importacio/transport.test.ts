import { describe, expect, it } from 'vitest'

import { desempaqueta, empaqueta } from './transport'

describe('transport dels fitxers', () => {
  it('el fitxer arriba igual, amb el nom i el tipus, i sense cap camp de tipus fitxer pel camí', async () => {
    const bytes = new Uint8Array(200_000).map((_, i) => (i * 37) % 256)
    const dades = new FormData()
    dades.append('full', new File([bytes], 'Comunicació resultats.xlsx', { type: 'application/vnd.ms-excel' }))
    dades.append('trn', new File([], ''))
    dades.append('pestanya', 'Respostes')

    const enviat = await empaqueta(dades)
    expect([...enviat.values()].some((v) => v instanceof File)).toBe(false)
    expect(enviat.get('trn:b64')).toBeNull()

    const rebut = desempaqueta(enviat)
    const full = rebut.get('full') as File
    expect(full).toBeInstanceOf(File)
    expect(full.name).toBe('Comunicació resultats.xlsx')
    expect(full.type).toBe('application/vnd.ms-excel')
    expect(new Uint8Array(await full.arrayBuffer())).toEqual(bytes)
    expect(rebut.get('pestanya')).toBe('Respostes')
    expect(rebut.get('full:nom')).toBeNull()
  })

  it('deixa estar un formulari que ja porta fitxers', async () => {
    const dades = new FormData()
    dades.append('full', new File([new Uint8Array([1, 2, 3])], 'a.csv'))
    const rebut = desempaqueta(dades)
    expect(new Uint8Array(await (rebut.get('full') as File).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  })
})
