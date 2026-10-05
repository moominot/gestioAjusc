import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { descodifica, llegeixCsv, llegeixFitxerDeResultats } from './fitxers'
import {
  ErrorFull,
  construeixTorneigDeFull,
  absentsDeAssignacions,
  ErrorColumnes,
  interpretaFiles,
  proposaColumnes,
  interpretaResultat,
  normalitzaMot,
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

describe('dades lliures del full', () => {
  it('desa les columnes que no són de resultats, amb nom conegut si en tenen', () => {
    const [primera, segona] = csv(
      'Ronda;Jugador 1;Puntuació 1;Jugador 2;Puntuació 2;Mesa;Foto full;Observacions;Àrbitre de sala\n' +
        '1;Anna;400;Bernat;350;3;https://x/f.jpg;Reclamació;Pere\n' +
        '1;Carla;380;Dani;390;;;;\n',
    )
    expect(primera.dades).toEqual({ taula: 3, full: 'https://x/f.jpg', comentaris: 'Reclamació', 'Àrbitre de sala': 'Pere' })
    expect(segona.dades).toBeUndefined()
  })

  it('les passa a les partides del torneig', () => {
    const torneig = construeixTorneigDeFull(csv('Jugador 1;Puntuació 1;Jugador 2;Puntuació 2;Taula\nAnna;400;Bernat;350;7\n'))
    expect(torneig.partides[0].dades).toEqual({ taula: 7 })
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

  /**
   * El Xàmpions d'estiu 2026: dues partides per ronda, i el full en posa les
   * rondes 1 a 5 i després, una altra vegada, 1 a 5.
   */
  it('numera seguides les rondes que el full repeteix per blocs', () => {
    const torneig = construeixTorneigDeFull(
      csv(
        `${CAPCALERA}\n1,Anna,1,Berta,0\n1,Cesc,1,Dídac,0\n2,Anna,0,Cesc,1\n2,Berta,1,Dídac,0\n` +
          `1,Anna,1,Berta,0\n1,Cesc,0,Dídac,1\n2,Anna,1,Cesc,0\n2,Berta,0,Dídac,1`,
      ),
    )
    expect(torneig.rondesPerBlocs).toBe(true)
    expect(torneig.rondesDeduides).toBe(false)
    expect(torneig.partides.map((p) => p.ronda)).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
  })

  it('no confon amb blocs un jugador repetit dins la mateixa ronda', () => {
    // Aquí la numeració no torna enrere: és un error del full i s'ha de dir.
    expect(() =>
      construeixTorneigDeFull(csv(`${CAPCALERA}\n1,Anna,1,Berta,0\n2,Anna,1,Cesc,0\n2,Anna,0,Dídac,1`)),
    ).toThrow(/més d'una partida a la ronda 2/)
  })

  it('amb les rondes bé, les deixa com són', () => {
    const torneig = construeixTorneigDeFull(csv(`${CAPCALERA}\n1,Anna,1,Berta,0\n2,Anna,1,Cesc,0`))
    expect(torneig.rondesPerBlocs).toBe(false)
    expect(torneig.partides.map((p) => p.ronda)).toEqual([1, 2])
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

describe('estadístiques de partida', () => {
  it('llegeix scrabbles i millors jugades amb els noms de columna del full de Manacor', () => {
    const files = interpretaFiles([
      ['Ronda', 'Jugador1', 'Jugador2', 'Punts_1', 'Punts_2', 'Puntuacio_1', 'Puntuacio_2',
        'Mot_1', 'Puntsmot_1', 'Scrabbles_1', 'Mot_2', 'Puntsmot_2', 'Scrabbles_2',
        'Lletra_1', 'Punts_lletra_1', 'Lletra_2', 'Punts_lletra_2'],
      [1, 'Xisco Truyols', 'Joan Pascual', 0, 1, 455, 481,
        'enrases', 75, 3, 'DESAREU', 82, 3, 'Ral.li', 33, null, null],
    ])

    // «Punts_1» és el resultat; mana «Puntuacio_1», que és la puntuació.
    expect(files[0].puntuacio1).toBe(455)
    expect(files[0].estadistiques).toEqual({
      jugador1: { scrabbles: 3, mot: 'ENRASES', puntsMot: 75, motLletra: 'RAL·LI', puntsLletra: 33 },
      jugador2: { scrabbles: 3, mot: 'DESAREU', puntsMot: 82, motLletra: null, puntsLletra: null },
    })
  })

  it('les passa a les partides del torneig', () => {
    const torneig = construeixTorneigDeFull(
      csv(`${CAPCALERA},Scrabbles 1,Scrabbles 2\n1,Anna,410,Berta,380,2,1\n1,Carles,300,Dani,350,,`),
    )
    expect(torneig.partides[0].estadistiques?.jugador1.scrabbles).toBe(2)
    expect(torneig.partides[0].estadistiques?.jugador2.scrabbles).toBe(1)
    // Sense cap dada, no n'hi ha.
    expect(torneig.partides[1].estadistiques).toBeNull()
  })

  it('normalitza els mots', () => {
    expect(normalitzaMot('Il.lesa')).toBe('IL·LESA')
    expect(normalitzaMot('al-le')).toBe('AL·LE')
    expect(normalitzaMot('col·lega')).toBe('COL·LEGA')
    expect(normalitzaMot('  xoc ')).toBe('XOC')
    expect(normalitzaMot('')).toBeNull()
    expect(normalitzaMot('-')).toBeNull()
  })
})

describe('correspondència de columnes triada a mà', () => {
  const files = [
    ['Qui', 'Pts', 'Contrari', 'Pts rival', 'Pista'],
    ['Anna', 400, 'Bel', 350, 'A1'],
  ]

  it('proposa la correspondència i falla sense assignacions si no es reconeixen', () => {
    const proposta = proposaColumnes(files)
    expect(proposta.capcalera).toEqual(['Qui', 'Pts', 'Contrari', 'Pts rival', 'Pista'])
    expect(proposta.exemples[0]).toBe('Anna')
    expect(absentsDeAssignacions(proposta.assignacions)).toHaveLength(4)
    expect(() => interpretaFiles(files)).toThrow(ErrorColumnes)
  })

  it('llegeix amb les assignacions triades i desa les lliures amb el nom de la capçalera', () => {
    const [fila] = interpretaFiles(files, ['jugador1', 'puntuacio1', 'jugador2', 'puntuacio2', 'lliure'])
    expect(fila).toMatchObject({ jugador1: 'Anna', puntuacio1: 400, jugador2: 'Bel', puntuacio2: 350 })
    expect(fila.dades).toEqual({ Pista: 'A1' })
  })

  it('ignora columnes i rebutja un camp assignat dues vegades', () => {
    const [fila] = interpretaFiles(files, ['jugador1', 'puntuacio1', 'jugador2', 'puntuacio2', 'ignora'])
    expect(fila.dades).toBeUndefined()
    expect(() =>
      interpretaFiles(files, ['jugador1', 'jugador1', 'jugador2', 'puntuacio2', 'ignora']),
    ).toThrow(/més d'una columna/)
  })
})
