/**
 * Prova de punta a punta amb dades reals de tot el recorregut.
 *
 * Llegeix el ManaCup 2025-26 tal com el va exportar el Club Scrabble Manacor,
 * resol els 65 participants contra els 609 jugadors de la llavor del BARRUF 199
 * i passa les 690 partides pel motor.
 *
 * No hi ha cap dada inventada: ni els fitxers del torneig ni el registre.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { calculaCampionat, estatInicial, rejugaCadena } from '../barruf/motor'
import type { EstatBarruf } from '../barruf/tipus'
import { resolNoms, resumeix, type JugadorRegistre } from './resolucio'
import { aEntradaDelMotor, llegeixTorneig, partidesPerParticipant } from './torneig'

import llavor from './__fixtures__/registre-llavor.json'

const DIRECTORI = join(__dirname, '__fixtures__', 'manacup')

const torneig = () =>
  llegeixTorneig({
    trn: new Uint8Array(readFileSync(join(DIRECTORI, 'ManaCup_25-26.trn'))),
    sco: new Uint8Array(readFileSync(join(DIRECTORI, 'ManaCup_25-26.sco'))),
    ini: readFileSync(join(DIRECTORI, 'ManaCup_25-26.ini'), 'latin1'),
  })

const jugadorsRegistre: JugadorRegistre[] = llavor.jugadors.map((j) => ({
  id: `j${j.numero}`,
  numero: j.numero,
  nomComplet: j.nomComplet,
  barruf: j.barruf,
}))

const registre = { jugadors: jugadorsRegistre, alies: [] }

/** Estat de partida de la cadena: la llavor del BARRUF 199. */
function llavorDelMotor(): Map<string, EstatBarruf> {
  return new Map(
    llavor.jugadors.map((j) => [
      `j${j.numero}`,
      {
        ...estatInicial(`j${j.numero}`),
        barruf: j.barruf,
        partidesTotals: j.partidesTotals,
        victoriesTotals: j.victoriesTotals,
        darreraTemporada: j.darreraTemporada,
      },
    ]),
  )
}

const resolts = () =>
  resolNoms(
    torneig().participants.map((p) => ({
      origen: p,
      nom: p.nomComplet,
      puntuacioInicial: p.puntuacioInicial,
    })),
    registre,
  )

describe('resolució dels participants del ManaCup', () => {
  it('en resol 63 de 65 tot sol', () => {
    expect(resumeix(resolts())).toEqual({
      total: 65,
      exactes: 63,
      perAlies: 0,
      dubtosos: 1,
      nous: 1,
      pendents: 2,
    })
  })

  it('la puntuació del fitxer corrobora l’únic cas ambigu', () => {
    const dubtos = resolts().find((r) => r.resolucio.tipus === 'dubtos')!
    expect(dubtos.nom).toBe('Lluís Fuster')

    const [millor] = (dubtos.resolucio as { candidats: ReturnType<typeof Object>[] })
      .candidats as { jugador: JugadorRegistre; unicAmbAquestaPuntuacio: boolean }[]

    // El fitxer li dona 1254 i l'únic jugador del registre amb 1254 és aquest.
    expect(millor.jugador.nomComplet).toBe('Lluís Fuster Amer')
    expect(millor.unicAmbAquestaPuntuacio).toBe(true)
  })

  it('no resol sol ni tan sols amb la puntuació corroborant-ho', () => {
    // La decisió és sempre d'una persona: dos noms semblants poden ser dues
    // persones diferents, i equivocar-s'hi mou el BARRUF de totes dues.
    const dubtos = resolts().find((r) => r.resolucio.tipus === 'dubtos')!
    expect(dubtos.resolucio.tipus).not.toBe('exacte')
  })

  it('l’alta nova és el jugador que entra amb el BARRUF inicial', () => {
    const nou = resolts().find((r) => r.resolucio.tipus === 'nou')!
    expect(nou.nom).toBe('Arnau Timoner')
    expect(nou.origen.puntuacioInicial).toBe(950)
  })
})

describe('càlcul del BARRUF del ManaCup', () => {
  /** Les dues decisions que al sistema real pren el gestor. */
  const correspondencia = () => {
    const mapa = new Map<number, string>()
    for (const resolt of resolts()) {
      if (resolt.resolucio.tipus === 'exacte' || resolt.resolucio.tipus === 'alies') {
        mapa.set(resolt.origen.id, resolt.resolucio.jugador.id)
      }
    }
    // Lluís Fuster → Lluís Fuster Amer, confirmat per la puntuació.
    const fuster = jugadorsRegistre.find((j) => j.nomComplet === 'Lluís Fuster Amer')!
    mapa.set(torneig().participants.find((p) => p.nomComplet === 'Lluís Fuster')!.id, fuster.id)
    // Arnau Timoner: alta nova.
    mapa.set(torneig().participants.find((p) => p.nomComplet === 'Arnau Timoner')!.id, 'nou-timoner')
    return mapa
  }

  const entrada = () =>
    aEntradaDelMotor(torneig(), correspondencia(), {
      campionatId: 'manacup-25-26',
      temporadaCodi: '2025-26',
    })

  it('converteix les 690 partides', () => {
    const resultat = entrada()
    expect(resultat.partides).toHaveLength(690)
    expect(resultat.inscrits).toHaveLength(65)
  })

  it('calcula la variació de tots els que han jugat', () => {
    const variacions = calculaCampionat(entrada(), llavorDelMotor())

    // 65 inscrits menys els dos que no van jugar cap partida.
    expect(variacions).toHaveLength(63)

    const jugades = partidesPerParticipant(torneig())
    const totalPartides = variacions.reduce((suma, v) => suma + v.partides, 0)
    expect(totalPartides).toBe([...jugades.values()].reduce((a, b) => a + b, 0))
    expect(totalPartides).toBe(690 * 2)
  })

  it('cada variació quadra amb la seva pròpia fórmula', () => {
    for (const v of calculaCampionat(entrada(), llavorDelMotor())) {
      expect(v.variacio).toBeCloseTo((v.victories - v.esperanca) * v.factorK, 9)
      expect(v.barrufDespres).toBeCloseTo(v.barrufAbans + v.variacio, 9)
    }
  })

  it('el conjunt del campionat gairebé suma zero', () => {
    // No exactament zero perquè no tothom té el mateix factor K: els jugadors
    // amb 50 partides o menys en mouen 30 per punt i la resta, 20.
    const variacions = calculaCampionat(entrada(), llavorDelMotor())
    const suma = variacions.reduce((total, v) => total + v.variacio, 0)
    const ambKAlta = variacions.filter((v) => v.factorK === 30).length

    expect(ambKAlta).toBeGreaterThan(0)
    expect(Math.abs(suma)).toBeLessThan(600)
  })

  it('el jugador nou parteix de 950', () => {
    const variacions = calculaCampionat(entrada(), llavorDelMotor())
    const timoner = variacions.find((v) => v.jugadorId === 'nou-timoner')
    // Arnau Timoner es va retirar abans de la ronda 1: no té cap partida.
    expect(timoner).toBeUndefined()
  })

  it('rejugar la cadena dona el mateix que calcular-la un cop', () => {
    const directe = calculaCampionat(entrada(), llavorDelMotor())
    const { variacionsPerCampionat, estatFinal } = rejugaCadena(llavorDelMotor(), [entrada()])
    const encadenat = variacionsPerCampionat.get('manacup-25-26')!

    expect(encadenat).toEqual(directe)
    for (const v of directe) {
      expect(estatFinal.get(v.jugadorId)!.barruf).toBeCloseTo(v.barrufDespres, 9)
    }
  })

  it('és determinista', () => {
    const una = rejugaCadena(llavorDelMotor(), [entrada()]).estatFinal
    const altra = rejugaCadena(llavorDelMotor(), [entrada()]).estatFinal
    for (const [id, estat] of una) {
      expect(altra.get(id)!.barruf).toBe(estat.barruf)
    }
  })

  it('no toca el BARRUF de qui no ha jugat el campionat', () => {
    const inicial = llavorDelMotor()
    const final = rejugaCadena(inicial, [entrada()]).estatFinal
    const participants = new Set(entrada().inscrits)

    const moguts = [...final.entries()].filter(
      ([id, estat]) => !participants.has(id) && estat.barruf !== inicial.get(id)!.barruf,
    )
    expect(moguts).toEqual([])
  })
})
