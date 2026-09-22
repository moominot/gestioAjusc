import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { descodifica, llegeixCsv, llegeixFitxerDeResultats } from './fitxers'
import {
  ErrorFull,
  construeixTorneigDeFull,
  interpretaFiles,
  interpretaResultat,
} from './fulls'

const csv = (text: string) => interpretaFiles(llegeixCsv(text))
const bytes = (text: string, codificacio: 'utf-8' | 'latin1' = 'utf-8') =>
  new Uint8Array(Buffer.from(text, codificacio === 'utf-8' ? 'utf8' : 'latin1'))

const CAPCALERA = 'Ronda,Jugador 1,Puntuació 1,Jugador 2,Puntuació 2'

describe('interpretaResultat', () => {
  it('reconeix el resultat de la partida quan les xifres són 1, 0,5 o 0', () => {
    expect(interpretaResultat(1, 0)).toEqual({ resultat: 1, sonPuntsScrabble: false })
    expect(interpretaResultat(0, 1)).toEqual({ resultat: 0, sonPuntsScrabble: false })
    expect(interpretaResultat(0.5, 0.5)).toEqual({ resultat: 0.5, sonPuntsScrabble: false })
  })

  it('tracta la resta de xifres com a puntuació d’Scrabble', () => {
    expect(interpretaResultat(361, 383)).toEqual({ resultat: 0, sonPuntsScrabble: true })
    expect(interpretaResultat(457, 280)).toEqual({ resultat: 1, sonPuntsScrabble: true })
    expect(interpretaResultat(400, 400)).toEqual({ resultat: 0.5, sonPuntsScrabble: true })
  })

  it('no confon un 1 a 0 de puntuació amb un resultat impossible', () => {
    // Cap partida d'Scrabble no acaba 2 a 0, així que això són punts.
    expect(interpretaResultat(2, 0).sonPuntsScrabble).toBe(true)
  })
})

describe('lectura del full', () => {
  it('llegeix la llista de resultats de l’AJUSC', () => {
    const files = csv(
      `${CAPCALERA}\n1,Mateu Marcé,361,Miquel Morey,383\n1,Margalida Cubells,457,Clara Zambrana,280`,
    )

    expect(files).toHaveLength(2)
    expect(files[0]).toEqual({
      fila: 2,
      ronda: 1,
      jugador1: 'Mateu Marcé',
      puntuacio1: 361,
      jugador2: 'Miquel Morey',
      puntuacio2: 383,
    })
  })

  it('accepta variants del nom de les columnes', () => {
    const files = csv('R,Blanc,Punts 1,Negre,Punts 2\n3,Anna,1,Berta,0')
    expect(files[0]).toMatchObject({ ronda: 3, jugador1: 'Anna', jugador2: 'Berta' })
  })

  it('accepta el punt i coma i la coma decimal', () => {
    const files = csv(`Ronda;Jugador 1;Puntuació 1;Jugador 2;Puntuació 2\n1;Anna;0,5;Berta;0,5`)
    expect(files[0]).toMatchObject({ puntuacio1: 0.5, puntuacio2: 0.5 })
  })

  it('explica què falta si la capçalera no encaixa', () => {
    expect(() => csv('a,b,c\n1,2,3')).toThrow(/No trobo les columnes/)
  })

  it('es planta si falta una puntuació', () => {
    expect(() => csv(`${CAPCALERA}\n1,Anna,,Berta,0`)).toThrow(/falta la puntuació/)
  })

  it('salta les files buides', () => {
    const files = csv(`${CAPCALERA}\n1,Anna,1,Berta,0\n,,,,\n1,Cesc,1,Dídac,0`)
    expect(files).toHaveLength(2)
  })
})

describe('construeixTorneigDeFull', () => {
  it('numera els jugadors per ordre d’aparició', () => {
    const torneig = construeixTorneigDeFull(
      csv(`${CAPCALERA}\n1,Anna,1,Berta,0\n2,Cesc,1,Anna,0`),
    )

    expect(torneig.participants.map((p) => p.nomComplet)).toEqual(['Anna', 'Berta', 'Cesc'])
    expect(torneig.partides).toHaveLength(2)
    expect(torneig.rondesJugades).toEqual([1, 2])
  })

  it('guarda la puntuació d’Scrabble quan n’hi ha', () => {
    const torneig = construeixTorneigDeFull(csv(`${CAPCALERA}\n1,Anna,361,Berta,383`))

    expect(torneig.ambPuntsScrabble).toBe(true)
    expect(torneig.partides[0]).toMatchObject({
      resultatBlanc: 0,
      puntsBlanc: 361,
      puntsNegre: 383,
    })
  })

  it('no en guarda cap quan les xifres són resultats', () => {
    const torneig = construeixTorneigDeFull(csv(`${CAPCALERA}\n1,Anna,1,Berta,0`))

    expect(torneig.ambPuntsScrabble).toBe(false)
    expect(torneig.partides[0]).toMatchObject({ puntsBlanc: null, puntsNegre: null })
  })

  it('registra el jugador que descansa sense inventar-li cap partida', () => {
    const torneig = construeixTorneigDeFull(
      csv(`${CAPCALERA}\n1,Anna,1,BYE,0\n1,Berta,1,Cesc,0`),
    )

    expect(torneig.participants.map((p) => p.nomComplet)).toEqual(['Anna', 'Berta', 'Cesc'])
    expect(torneig.partides).toHaveLength(1)
  })

  it('tracta la casella buida d’adversari com un descans', () => {
    const torneig = construeixTorneigDeFull(csv(`${CAPCALERA}\n1,Anna,1,,`))
    expect(torneig.partides).toHaveLength(0)
    expect(torneig.participants).toHaveLength(1)
  })

  it('reparteix les rondes tot sol si el full no en porta', () => {
    // Sense columna de ronda, tres partides seguides d'Anna han d'anar a rondes
    // diferents perquè la base de dades no admet repetir-la dins d'una ronda.
    const torneig = construeixTorneigDeFull(
      csv('Jugador 1,Puntuació 1,Jugador 2,Puntuació 2\nAnna,1,Berta,0\nAnna,1,Cesc,0\nAnna,0,Dídac,1'),
    )

    expect(torneig.rondesDeduides).toBe(true)
    expect(torneig.partides.map((p) => p.ronda)).toEqual([1, 2, 3])
  })

  it('agrupa a la mateixa ronda les partides que no es trepitgen', () => {
    const torneig = construeixTorneigDeFull(
      csv('Jugador 1,Puntuació 1,Jugador 2,Puntuació 2\nAnna,1,Berta,0\nCesc,1,Dídac,0'),
    )
    expect(torneig.partides.map((p) => p.ronda)).toEqual([1, 1])
  })

  it('es planta si un jugador repeteix ronda', () => {
    expect(() =>
      construeixTorneigDeFull(csv(`${CAPCALERA}\n1,Anna,1,Berta,0\n1,Anna,1,Cesc,0`)),
    ).toThrow(/més d'una partida a la ronda 1/)
  })

  it('es planta si algú juga contra si mateix', () => {
    expect(() => construeixTorneigDeFull(csv(`${CAPCALERA}\n1,Anna,1,Anna,0`))).toThrow(
      /contra si mateix/,
    )
  })

  it('iguala les variants del mateix nom dins del full', () => {
    // 'ANNA PUIG' i 'Anna Puig' són el mateix participant.
    const torneig = construeixTorneigDeFull(
      csv(`${CAPCALERA}\n1,Anna Puig,1,Berta,0\n2,ANNA PUIG,1,Cesc,0`),
    )
    expect(torneig.participants).toHaveLength(3)
  })
})

describe('descodificació', () => {
  it('llegeix un CSV en UTF-8', () => {
    expect(descodifica(bytes('Mateu Xurí'))).toBe('Mateu Xurí')
  })

  it('llegeix un CSV que l’Excel ha desat en Windows-1252', () => {
    expect(descodifica(bytes('Mateu Xurí', 'latin1'))).toBe('Mateu Xurí')
  })

  it('treu la marca d’ordre de bytes', () => {
    expect(descodifica(bytes('﻿Ronda'))).toBe('Ronda')
  })
})

describe('llegeixFitxerDeResultats', () => {
  it('obre un CSV pel nom del fitxer', async () => {
    const { files, pestanya } = await llegeixFitxerDeResultats(
      'resultats.csv',
      bytes(`${CAPCALERA}\n1,Anna,1,Berta,0`),
    )
    expect(files).toHaveLength(1)
    expect(pestanya).toBeNull()
  })

  it('rebutja els formats que no sap obrir', async () => {
    await expect(llegeixFitxerDeResultats('resultats.pdf', bytes('x'))).rejects.toThrow(ErrorFull)
  })
})

describe('full de càlcul .xlsx', () => {
  it('obre un full real i en llegeix els resultats', async () => {
    const dades = new Uint8Array(
      readFileSync(join(__dirname, '__fixtures__', 'resultats-exemple.xlsx')),
    )
    const { files, pestanya } = await llegeixFitxerDeResultats('resultats-exemple.xlsx', dades)

    expect(pestanya).toBe('Resultats')
    expect(files).toHaveLength(6)
    expect(files[0]).toMatchObject({
      ronda: 1,
      jugador1: 'Mateu Marcé',
      puntuacio1: 361,
      jugador2: 'Miquel Morey',
      puntuacio2: 383,
    })
  })

  it('barreja sense problemes puntuacions i resultats al mateix full', async () => {
    const dades = new Uint8Array(
      readFileSync(join(__dirname, '__fixtures__', 'resultats-exemple.xlsx')),
    )
    const { files } = await llegeixFitxerDeResultats('resultats-exemple.xlsx', dades)
    const torneig = construeixTorneigDeFull(files)

    // Cinc partides jugades: la sisena fila és un descans.
    expect(torneig.partides).toHaveLength(5)
    expect(torneig.participants.map((p) => p.nomComplet)).toEqual([
      'Mateu Marcé',
      'Miquel Morey',
      'Margalida Cubells',
      'Clara Zambrana',
      'Carles Díez',
      'Antoni Riera',
    ])

    // La partida amb puntuació d'Scrabble la desa; la del resultat 1-0, no.
    expect(torneig.partides[0]).toMatchObject({ puntsBlanc: 361, resultatBlanc: 0 })
    expect(torneig.partides[3]).toMatchObject({ puntsBlanc: null, resultatBlanc: 1 })
    expect(torneig.partides[4]).toMatchObject({ resultatBlanc: 0.5 })
  })
})
