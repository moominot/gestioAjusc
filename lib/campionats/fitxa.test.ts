import { describe, expect, it } from 'vitest'

import { classificacio, estadistiques, perRonda, type FitxaCampionat, type JugadorCampionat } from './fitxa'

const jugador = (nom: string, victories: number, favor: number | null, contra: number | null): JugadorCampionat => ({
  numero: nom.length,
  nom,
  club: null,
  partides: 5,
  victories,
  punts_favor: favor,
  punts_contra: contra,
  millor_puntuacio: null,
  barruf_abans: null,
  barruf_despres: null,
  variacio: null,
  esperanca: null,
  factor_k: null,
  posicio: null,
  posicio_anterior: null,
  estat: null,
})

describe('classificacio', () => {
  it('ordena per victòries i desempata per diferència de punts', () => {
    const files = classificacio([
      jugador('Berta', 3, 2000, 1900),
      jugador('Anna', 4, 2100, 2050),
      jugador('Cesc', 3, 2200, 1950),
    ])
    expect(files.map((f) => [f.lloc, f.nom, f.diferencia])).toEqual([
      [1, 'Anna', 50],
      [2, 'Cesc', 250],
      [3, 'Berta', 100],
    ])
  })

  it('comparteix lloc amb les mateixes victòries i diferència, i sense punts només per victòries', () => {
    const files = classificacio([jugador('Anna', 2, null, null), jugador('Berta', 2, null, null), jugador('Cesc', 1, null, null)])
    expect(files.map((f) => f.lloc)).toEqual([1, 1, 3])
  })
})

describe('estadistiques', () => {
  const fitxa: FitxaCampionat = {
    campionat: {
      id: 'x', nom: 'Prova', data: '2026-07-01', temporada: '2025-26', organitzador: null,
      club_organitzador: null, computa_barruf: true, finalitzat: true, barrufat: true,
      rondes_jugades: 2, rondes_previstes: null, primera_edicio: 210,
    },
    jugadors: [
      { ...jugador('Anna', 1, 900, 800), variacio: 12.4 },
      { ...jugador('Berta', 1, 800, 900), variacio: -12.4 },
    ],
    partides: [
      { id: 'b', ronda: 2, numero_1: 1, jugador_1: 'Anna', numero_2: 2, jugador_2: 'Berta', resultat_1: 0, punts_1: 350, punts_2: 380 },
      { id: 'a', ronda: 1, numero_1: 1, jugador_1: 'Anna', numero_2: 2, jugador_2: 'Berta', resultat_1: 1, punts_1: 550, punts_2: 420 },
    ],
  }

  it('treu les xifres del campionat', () => {
    const e = estadistiques(fitxa)
    expect(e.partides).toBe(2)
    expect(e.rondes).toBe(2)
    expect(e.mitjanaPartida).toBe(425)
    expect(e.millorPuntuacio).toMatchObject({ punts: 550, jugador: 'Anna', ronda: 1 })
    expect(e.majorVictoria).toMatchObject({ guanyador: 'Anna', marcador: '550–420', diferencia: 130 })
    expect(e.mesPujada).toEqual({ nom: 'Anna', variacio: 12.4 })
  })

  it('agrupa les partides per ronda', () => {
    expect(perRonda(fitxa.partides).map(([r, ps]) => [r, ps.length])).toEqual([[1, 1], [2, 1]])
  })
})
