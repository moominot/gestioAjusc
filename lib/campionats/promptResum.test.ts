import { describe, expect, it } from 'vitest'

import { classificacio, estadistiques, type FitxaCampionat, type JugadorCampionat } from './fitxa'
import { promptResum, type DadesPrompt } from './promptResum'

const jugador = (nom: string, victories: number): JugadorCampionat => ({
  numero: nom.length,
  nom,
  club: 'Club X',
  partides: 5,
  victories,
  punts_favor: 2000,
  punts_contra: 1900,
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

const fitxa: FitxaCampionat = {
  campionat: {
    id: 'x',
    nom: 'Open de Palma',
    data: '2026-03-14',
    temporada: '2025-26',
    organitzador: null,
    club_organitzador: 'Club Palma',
    computa_barruf: true,
    finalitzat: true,
    barrufat: false,
    rondes_jugades: 5,
    rondes_previstes: 5,
    primera_edicio: null,
  },
  jugadors: [jugador('Anna', 4), jugador('Berta', 3)],
  partides: [],
}

const dades = (notes = ''): DadesPrompt => ({
  campionat: fitxa.campionat,
  notes,
  classificacio: classificacio(fitxa.jugadors),
  estadistiques: estadistiques(fitxa),
})

describe('promptResum', () => {
  it('posa la classificació oficial tal com la dona el gestor', () => {
    const text = promptResum(dades(), '1. Berta\n2. Anna')
    expect(text).toContain('## Classificació final (oficial)\n1. Berta\n2. Anna')
    expect(text).toContain('Nom: Open de Palma')
    expect(text).toContain('Organitza: Club Palma')
    expect(text).not.toContain('## Notes')
  })

  it('sense classificació oficial, hi posa la calculada i ho avisa', () => {
    const text = promptResum(dades('Gran ambient'), '  ')
    expect(text).toContain("no n'ha facilitat la classificació oficial")
    expect(text).toContain('1. Anna (Club X) — 4 victòries en 5 partides')
    expect(text).toContain("## Notes de l'organització\nGran ambient")
  })
})
