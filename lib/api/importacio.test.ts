import { describe, expect, it } from 'vitest'

import { validaImportacio } from './importacio'

const bona = () => ({
  id_extern: 'torneig-17',
  campionat: { nom: 'Obert de prova', data: '2026-10-10', acabat: true, dades: { lloc: 'Manacor' } },
  participants: [
    { id: 'a', nom: 'Maribel Servera', numero: 230 },
    { id: 'b', nom: 'Jugador Nou' },
    { id: 'c', nom: 'Tercer' },
  ],
  partides: [
    { ronda: 1, jugador_1: 'a', jugador_2: 'b', punts_1: 420, punts_2: 380, mot_1: 'quiquiriquic', punts_mot_1: 98, dades: { full: 'https://x/full.jpg' } },
    { ronda: 1, jugador_1: 'c', jugador_2: null },
    { ronda: 2, jugador_1: 'b', jugador_2: 'c', resultat_1: 0.5 },
  ],
})

describe('validaImportacio', () => {
  it('accepta una importació bona i en dedueix els resultats', () => {
    const v = validaImportacio(bona())
    expect(v.ok).toBe(true)
    if (!v.ok) return
    const [p1, descans, p3] = v.importacio.partides
    expect(p1.resultat_1).toBe(1)
    expect(p1.mot_1).toBe('QUIQUIRIQUIC')
    expect(p1.dades).toEqual({ full: 'https://x/full.jpg' })
    expect(descans.resultat_1).toBe(1)
    expect(p3.resultat_1).toBe(0.5)
    expect(v.importacio.participants[1].numero).toBeNull()
    expect(v.importacio.campionat.acabat).toBe(true)
  })

  it('diu tots els errors amb el camí de cada camp', () => {
    const dolenta = bona() as Record<string, unknown>
    dolenta.id_extern = ''
    ;(dolenta.campionat as Record<string, unknown>).data = '10/10/2026'
    ;(dolenta.participants as Record<string, unknown>[]).push({ id: 'a', nom: 'Repetit' })
    ;(dolenta.partides as Record<string, unknown>[]).push(
      { ronda: 2, jugador_1: 'a', jugador_2: 'z', punts_1: 300 },
      { ronda: 1, jugador_1: 'a', jugador_2: 'c', resultat_1: 2 },
    )
    const v = validaImportacio(dolenta)
    expect(v.ok).toBe(false)
    if (v.ok) return
    expect(v.errors).toEqual(
      expect.arrayContaining([
        'id_extern: és obligatori',
        'campionat.data: ha de ser AAAA-MM-DD',
        'participants[3].id: «a» està repetit',
        'partides[3].jugador_2: «z» no és a la llista de participants',
        'partides[3]: cal la puntuació dels dos jugadors, o de cap',
        'partides[4]: «a» ja té una partida a la ronda 1',
        'partides[4].resultat_1: ha de ser 1, 0.5 o 0',
      ]),
    )
  })

  it('rebutja el que no és un objecte', () => {
    expect(validaImportacio([1, 2])).toEqual({ ok: false, errors: ['El cos ha de ser un objecte JSON.'] })
  })
})
