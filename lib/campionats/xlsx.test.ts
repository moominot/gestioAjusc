import writeExcelFile from 'write-excel-file/node'
import { describe, expect, it } from 'vitest'

import type { FitxaCampionat } from './fitxa'
import { pestanyesCampionat, type FilaBarruf } from './xlsx'

const fitxa = {
  campionat: {
    id: 'x', nom: 'Open', data: '2026-01-10', temporada: '2025-26', organitzador: null,
    club_organitzador: 'Manacor', computa_barruf: true, finalitzat: true, barrufat: true,
    rondes_jugades: 2, rondes_previstes: 3, primera_edicio: 210,
  },
  jugadors: [],
  partides: [
    { id: '1', ronda: 2, numero_1: 1, jugador_1: 'Anna', numero_2: 2, jugador_2: 'Bel', resultat_1: 1, punts_1: 400, punts_2: 350, dades: { Taula: 3 } },
    { id: '2', ronda: 1, numero_1: 3, jugador_1: 'Cris', numero_2: null, jugador_2: null, resultat_1: 1, punts_1: null, punts_2: null, dades: { Nota: 'ok' } },
  ],
} as unknown as FitxaCampionat

const fila = { posicio: 1, jugador_numero: 1, nom_complet: 'Anna', club: null, barruf: '1500.5', categoria: null,
  partides_totals: 10, victories_totals: '6', partides_temporada: 2, victories_temporada: '1',
  darrera_temporada: '2025-26', posicio_anterior: null, barruf_anterior: null, edicio: 210 } as FilaBarruf

describe('llibre del campionat', () => {
  const pestanyes = pestanyesCampionat(fitxa, { arbitre: 'Joan' }, { act: [fila], inact: [] })

  it('porta les pestanyes en ordre, amb les dades lliures', () => {
    expect(pestanyes.map((p) => p.nom)).toEqual([
      'Campionat', 'Partides', 'BARRUF actius', 'BARRUF en espera', 'BARRUF inactius', 'BARRUF novells',
    ])
    expect(pestanyes[0].files).toContainEqual(['arbitre', 'Joan'])
    const partides = pestanyes[1].files
    expect(partides[0].slice(-2)).toEqual(['Nota', 'Taula'])
    expect(partides[1][0]).toBe(1) // ordenades per ronda
    expect(partides[1][4]).toBe('descansa')
    expect(partides[2].slice(-2)).toEqual([null, 3])
    expect(pestanyes[2].files[1][4]).toBe(1500.5)
  })

  it('s\'escriu com a xlsx', async () => {
    const buf = await writeExcelFile(
      pestanyes.map((p) => ({
        sheet: p.nom,
        data: p.files.map((f) => f.map((v) => (v === null ? null : { value: v, type: typeof v === 'number' ? Number : String }))),
      })),
    ).toBuffer()
    expect(buf.byteLength).toBeGreaterThan(1000)
  })
})
