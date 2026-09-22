import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ErrorDbase, llegeixDbase } from './dbase'
import { construeixCampionat, llegeixRonda } from './swissperfect'
import {
  ErrorTorneig,
  llegeixInfo,
  llegeixParticipants,
  llegeixResultats,
  llegeixTorneig,
  partidesPerParticipant,
} from './torneig'

const DIRECTORI = join(__dirname, '__fixtures__', 'manacup')
const binari = (nom: string) => new Uint8Array(readFileSync(join(DIRECTORI, nom)))
const text = (nom: string) => readFileSync(join(DIRECTORI, nom), 'utf8')

const trn = () => binari('ManaCup_25-26.trn')
const sco = () => binari('ManaCup_25-26.sco')
const ini = () => readFileSync(join(DIRECTORI, 'ManaCup_25-26.ini'), 'latin1')

const torneig = () => llegeixTorneig({ trn: trn(), sco: sco(), ini: ini() })

describe('llegeixDbase', () => {
  it('llegeix la capçalera del .trn real', () => {
    const taula = llegeixDbase(trn())

    expect(taula.camps).toHaveLength(24)
    expect(taula.camps[0]).toEqual({ nom: 'ORDER', tipus: 'N', longitud: 5, decimals: 0 })
    expect(taula.camps.map((c) => c.nom)).toContain('SURNAME')
    expect(taula.registres).toHaveLength(72)
  })

  it('descodifica els accents catalans en Windows-1252', () => {
    const cognoms = llegeixDbase(trn()).registres.map((r) => r.SURNAME)
    expect(cognoms).toContain('Xurí')
    expect(cognoms).toContain('Llodrà')
    expect(cognoms).toContain('Díez')
    expect(cognoms).toContain('Reynés')
  })

  it('rebutja el que no és un dBase III', () => {
    expect(() => llegeixDbase(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toThrow(ErrorDbase)
  })

  it('rebutja un fitxer truncat', () => {
    expect(() => llegeixDbase(trn().subarray(0, 900))).toThrow(/truncat/)
  })
})

describe('llegeixParticipants', () => {
  it('llegeix els 65 jugadors i descarta els registres en blanc', () => {
    const participants = llegeixParticipants(trn())
    // El fitxer té 72 registres: 65 jugadors i 7 de reserva en blanc.
    expect(participants).toHaveLength(65)
  })

  it('compon el nom sencer', () => {
    const primer = llegeixParticipants(trn())[0]
    expect(primer).toMatchObject({
      id: 1,
      cognoms: 'Xurí',
      nom: 'Mateu',
      nomComplet: 'Mateu Xurí',
      puntuacioInicial: 1399,
    })
  })

  it('recull la ronda de retirada', () => {
    const retirats = llegeixParticipants(trn()).filter((p) => p.retiratDesDeLaRonda !== null)
    expect(
      retirats.map((p) => [p.id, p.retiratDesDeLaRonda]).sort((a, b) => a[0]! - b[0]!),
    ).toEqual([
      [7, 1],
      [54, 19],
      [58, 14],
      [59, 19],
      [60, 1],
    ])
  })
})

describe('llegeixResultats', () => {
  it('llegeix les 23 rondes jugades i les 2 pendents', () => {
    const { partides, rondesJugades, rondesPendents } = llegeixResultats(sco())

    expect(rondesJugades).toEqual(Array.from({ length: 23 }, (_, i) => i + 1))
    expect(rondesPendents).toEqual([24, 25])
    expect(partides).toHaveLength(690)
  })

  it('desdobla la puntuació d’Scrabble', () => {
    // Al fitxer hi consta 722–766; al full de l'AJUSC, 361–383.
    const primera = llegeixResultats(sco()).partides[0]
    expect(primera).toEqual({
      ronda: 1,
      blancId: 40,
      negreId: 43,
      resultatBlanc: 0,
      puntsBlanc: 361,
      puntsNegre: 383,
    })
  })

  it('desdobla el resultat de la partida', () => {
    const { partides } = llegeixResultats(sco())
    const empats = partides.filter((p) => p.resultatBlanc === 0.5)
    // Dos empats a tot el torneig: rondes 15 i 19.
    expect(empats.map((p) => p.ronda)).toEqual([15, 19])
  })

  it('cap resultat no es queda fora dels tres valors possibles', () => {
    const valors = new Set(llegeixResultats(sco()).partides.map((p) => p.resultatBlanc))
    expect([...valors].sort()).toEqual([0, 0.5, 1])
  })
})

describe('llegeixInfo', () => {
  it('llegeix les dades generals', () => {
    expect(llegeixInfo(ini())).toEqual({
      nom: 'XII ManaCup',
      organitzador: 'Club Scrabble Manacor',
      arbitre: '',
      rondesPrevistes: 26,
    })
  })

  it('no es queixa si falta la secció', () => {
    expect(llegeixInfo('[Altra cosa]\nClau=1')).toMatchObject({ nom: '', rondesPrevistes: null })
  })
})

describe('llegeixTorneig', () => {
  it('ajunta els tres fitxers', () => {
    const resultat = torneig()

    expect(resultat.info?.nom).toBe('XII ManaCup')
    expect(resultat.participants).toHaveLength(65)
    expect(resultat.partides).toHaveLength(690)
    expect(resultat.rondesPendents).toEqual([24, 25])
  })

  it('detecta els inscrits que no han jugat mai', () => {
    const resultat = torneig()
    const jugades = partidesPerParticipant(resultat)
    const senseJugar = resultat.participants
      .filter((p) => !jugades.has(p.id))
      .map((p) => p.id)
      .sort((a, b) => a - b)

    // Pere Grimalt Vert i Arnau Timoner, tots dos retirats abans de la ronda 1.
    expect(senseJugar).toEqual([7, 60])
  })

  it('rebutja resultats que citin un jugador desconegut', () => {
    const participantsRetallats = llegeixParticipants(trn())
    expect(participantsRetallats.length).toBeGreaterThan(0)
    // Un .trn amb un sol jugador no pot sostenir 690 partides.
    const nomes = trn().slice()
    // Esborrem tots els registres menys el primer marcant-los com a esborrats.
    const capcalera = new DataView(nomes.buffer).getUint16(8, true)
    const longitud = new DataView(nomes.buffer).getUint16(10, true)
    for (let i = 1; i < 72; i++) nomes[capcalera + i * longitud] = 0x2a
    expect(() => llegeixTorneig({ trn: nomes, sco: sco() })).toThrow(ErrorTorneig)
  })
})

describe('el .sco i els .rnd expliquen el mateix', () => {
  it('coincideixen a totes les partides que tenen en comú', () => {
    const delSco = new Map(
      torneig().partides.map((p) => [`${p.ronda}:${p.blancId}:${p.negreId}`, p.resultatBlanc]),
    )

    const delsRnd = construeixCampionat(
      readdirSync(DIRECTORI)
        .filter((nom) => nom.endsWith('.rnd'))
        .map((nom) => text(nom)),
    )

    let comparades = 0
    for (const partida of delsRnd.partides) {
      const clau = `${partida.ronda}:${partida.blancId}:${partida.negreId}`
      expect(delSco.get(clau), `partida ${clau}`).toBe(partida.resultatBlanc)
      comparades++
    }
    expect(comparades).toBe(450)
  })

  it('el .sco aporta les rondes que a l’exportació de text li falten', () => {
    const rondesRnd = new Set(
      readdirSync(DIRECTORI)
        .filter((nom) => nom.endsWith('.rnd'))
        .map((nom) => llegeixRonda(text(nom))[0].ronda),
    )
    const queFalten = torneig().rondesJugades.filter((r) => !rondesRnd.has(r))

    // De l'exportació de text en falten vuit rondes de les 23 jugades: la 3 a
    // la 9, que l'organitzador no va exportar, i la 23, jugada després.
    expect(queFalten).toEqual([3, 4, 5, 6, 7, 8, 9, 23])
  })

  it('i també la puntuació d’Scrabble, que els .rnd no porten', () => {
    const ambPunts = torneig().partides.filter((p) => p.puntsBlanc !== null)
    expect(ambPunts).toHaveLength(690)
  })
})
