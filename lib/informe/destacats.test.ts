import { describe, expect, it } from 'vitest'

import { destacats } from './destacats'
import type { FilaCrua, InformeCru } from './model'

let n = 1
const fila = (nom: string, f: Partial<FilaCrua>, anterior: Partial<NonNullable<FilaCrua['anterior']>> | null): FilaCrua => ({
  numero: n++,
  nom,
  club: null,
  ordre: n,
  barruf: 1100,
  estat: 'act',
  posicio: 1,
  debutant: false,
  partides_totals: 100,
  victories_totals: 50,
  partides_temporada: 20,
  victories_temporada: 10,
  ...f,
  anterior: anterior === null ? null : {
    barruf: 1100, estat: 'act', posicio: 1, partides_totals: 80, victories_totals: 40, ...anterior,
  },
})

const informe = (files: FilaCrua[]): InformeCru => ({
  edicio: { numero: 210, data_publicacio: '2026-08-31', temporada: '2025-26', campionats_computats: null, resultats_acumulats: null, campionats_acumulats: null },
  anterior: 190,
  files,
  clubs: [],
  campionats_temporada: 20,
})

describe('destacats', () => {
  const maribel = fila('Maribel Servera', { barruf: 1439, posicio: 1, partides_temporada: 42, victories_temporada: 36.5 }, { barruf: 1310, posicio: 8 })
  const mateu = fila('Mateu Xurí', { barruf: 1354, posicio: 3 }, { barruf: 1399, posicio: 1 })
  const debutant = fila('Joan Pons', { barruf: 1096, posicio: 59, debutant: true }, null)
  const torna = fila('Francesc Gallén', { barruf: 1139, posicio: 50, partides_temporada: 36, victories_temporada: 24 }, { barruf: 917, posicio: null, estat: 'inact' })
  const d = destacats(informe([maribel, mateu, debutant, torna]))

  it('ordena pujades i baixades sense comptar els debutants', () => {
    expect(d.mesPujada.map((j) => [j.nom, j.valor])).toEqual([
      ['Francesc Gallén', '+222'],
      ['Maribel Servera', '+129'],
    ])
    expect(d.mesBaixada.map((j) => [j.nom, j.valor])).toEqual([['Mateu Xurí', '-45']])
  })

  it('troba debutants, recuperats i el podi d’abans i d’ara', () => {
    expect(d.debutants.map((j) => j.nom)).toEqual(['Joan Pons'])
    expect(d.recuperats.map((j) => j.nom)).toEqual(['Francesc Gallén'])
    expect(d.podi.ara.map((j) => j.nom)).toEqual(['Maribel Servera', 'Mateu Xurí'])
    expect(d.podi.abans.map((j) => j.nom)).toEqual(['Mateu Xurí'])
  })

  it('detecta qui puja de categoria', () => {
    expect(d.pujadesCategoria.map((j) => [j.nom, j.abans, j.ara])).toEqual([['Maribel Servera', 2, 1]])
  })

  it('el percentatge només compta qui ha jugat prou partides', () => {
    expect(d.millorPercentatge.map((j) => j.nom)).toEqual(['Maribel Servera', 'Francesc Gallén', 'Mateu Xurí', 'Joan Pons'])
    expect(d.millorPercentatge[0].valor).toBe('87% (36,5 de 42)')
  })
})
