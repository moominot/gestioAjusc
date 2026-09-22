import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolNoms, type JugadorRegistre } from '../importacio/resolucio'
import { aEntradaDelMotor, llegeixTorneig } from '../importacio/torneig'
import { calculaEdicio, type JugadorLlavor } from './publicacio'
import type { CampionatEntrada } from './tipus'

import llavorJson from '../importacio/__fixtures__/registre-llavor.json'

const DIRECTORI = join(__dirname, '..', 'importacio', '__fixtures__', 'manacup')

const llavor: JugadorLlavor[] = llavorJson.jugadors.map((j) => ({
  jugadorId: String(j.numero),
  barruf: j.barruf,
  partidesTotals: j.partidesTotals,
  victoriesTotals: j.victoriesTotals,
  partidesTemporada: 0,
  victoriesTemporada: 0,
  darreraTemporada: j.darreraTemporada,
  cohortLlegat: j.cohortLlegat,
}))

const numeroDe = (nom: string) =>
  String(llavorJson.jugadors.find((j) => j.nomComplet === nom)!.numero)

/** El ManaCup sencer, amb les mateixes decisions que prendria el gestor. */
function manacup(): CampionatEntrada {
  const torneig = llegeixTorneig({
    trn: new Uint8Array(readFileSync(join(DIRECTORI, 'ManaCup_25-26.trn'))),
    sco: new Uint8Array(readFileSync(join(DIRECTORI, 'ManaCup_25-26.sco'))),
    ini: readFileSync(join(DIRECTORI, 'ManaCup_25-26.ini'), 'latin1'),
  })

  const registre: JugadorRegistre[] = llavorJson.jugadors.map((j) => ({
    id: String(j.numero),
    numero: j.numero,
    nomComplet: j.nomComplet,
    barruf: j.barruf,
  }))

  const resolts = resolNoms(
    torneig.participants.map((p) => ({
      origen: p,
      nom: p.nomComplet,
      puntuacioInicial: p.puntuacioInicial,
    })),
    { jugadors: registre, alies: [] },
  )

  const correspondencia = new Map<number, string>()
  for (const resolt of resolts) {
    if (resolt.resolucio.tipus === 'exacte' || resolt.resolucio.tipus === 'alies') {
      correspondencia.set(resolt.origen.id, resolt.resolucio.jugador.id)
    } else if (resolt.nom === 'Lluís Fuster') {
      correspondencia.set(resolt.origen.id, numeroDe('Lluís Fuster Amer'))
    } else {
      correspondencia.set(resolt.origen.id, 'nou-timoner')
    }
  }

  return aEntradaDelMotor(torneig, correspondencia, {
    campionatId: 'manacup',
    temporadaCodi: '2025-26',
  })
}

describe('calculaEdicio sense cap campionat', () => {
  const edicio = calculaEdicio(llavor, [], '2025-26')

  it('manté el BARRUF de tothom', () => {
    const moguts = edicio.valors.filter(
      (v) => v.barruf !== llavor.find((j) => j.jugadorId === v.jugadorId)!.barruf,
    )
    expect(moguts).toEqual([])
  })

  it('reprodueix els 167 actius de la llavor', () => {
    expect(edicio.valors.filter((v) => v.estat === 'act')).toHaveLength(167)
  })

  it('només els actius tenen posició', () => {
    const ambPosicio = edicio.valors.filter((v) => v.posicio !== null)
    expect(ambPosicio).toHaveLength(167)
    expect(ambPosicio.every((v) => v.estat === 'act')).toBe(true)
  })

  it('els empatats comparteixen posició i la següent se salta', () => {
    const actius = edicio.valors.filter((v) => v.estat === 'act')
    const primers = actius.slice(0, 6).map((v) => v.posicio)
    // A la llavor, Maribel Servera i Xisco Truyols empaten a 1343.
    expect(primers).toEqual([1, 2, 3, 4, 4, 6])
  })
})

describe("l'escombrada d'inactivitat depèn de la temporada", () => {
  it('en passar a 2026-27, setze actius passen a inactius', () => {
    const ara = calculaEdicio(llavor, [], '2025-26')
    const despres = calculaEdicio(llavor, [], '2026-27')

    const actiusAra = new Set(
      ara.valors.filter((v) => v.estat === 'act').map((v) => v.jugadorId),
    )
    const actiusDespres = new Set(
      despres.valors.filter((v) => v.estat === 'act').map((v) => v.jugadorId),
    )
    const perduts = [...actiusAra].filter((id) => !actiusDespres.has(id))

    expect(perduts).toHaveLength(16)
    expect([...actiusDespres].filter((id) => !actiusAra.has(id))).toEqual([])
  })
})

describe('calculaEdicio amb el ManaCup', () => {
  const edicio = calculaEdicio(llavor, [manacup()], '2025-26')
  const de = (nom: string) => edicio.valors.find((v) => v.jugadorId === numeroDe(nom))!

  it('reprodueix les xifres de la simulació', () => {
    // Els mateixos valors que dona `npm run simula`, contrastats al seu dia
    // amb una implementació independent en Python.
    expect(de('Xisco Truyols').barruf).toBeCloseTo(1402.9, 0)
    expect(de('Mateu Xurí').barruf).toBeCloseTo(1374.9, 0)
    expect(de('Josep Reynés').barruf).toBeCloseTo(1180.9, 0)
    expect(de('Maribel Servera').barruf).toBeCloseTo(1379.1, 0)
  })

  it('en Xisco Truyols passa a encapçalar la classificació', () => {
    expect(de('Xisco Truyols').posicio).toBe(1)
    expect(de('Mateu Xurí').posicio).toBe(3)
  })

  it('acumula les partides i les victòries', () => {
    const xuri = de('Mateu Xurí')
    // A la llavor en tenia 407; al ManaCup n'hi va jugar 23.
    expect(xuri.partidesTotals).toBe(430)
    expect(xuri.partidesTemporada).toBe(23)
  })

  it('no toca el BARRUF de qui no hi ha jugat', () => {
    const jugadors = new Set(manacup().inscrits)
    const moguts = edicio.valors.filter((v) => {
      if (jugadors.has(v.jugadorId)) return false
      return v.barruf !== llavor.find((j) => j.jugadorId === v.jugadorId)!.barruf
    })
    expect(moguts).toEqual([])
  })

  it('guarda el detall auditable de cada jugador', () => {
    const variacions = edicio.variacions.get('manacup')!
    expect(variacions).toHaveLength(63)
    for (const v of variacions) {
      expect(v.barrufDespres).toBeCloseTo(v.barrufAbans + v.variacio, 9)
    }
  })

  it('deixa de comptar com a cohort de llegat qui hi ha jugat', () => {
    // Qui juga un campionat barrufat ja té temporada coneguda.
    const jugadors = new Set(manacup().inscrits)
    const llegatQueHaJugat = edicio.valors.filter(
      (v) => jugadors.has(v.jugadorId) && v.cohortLlegat,
    )
    expect(llegatQueHaJugat).toEqual([])
  })

  it('és determinista', () => {
    const altra = calculaEdicio(llavor, [manacup()], '2025-26')
    expect(altra.valors.map((v) => [v.jugadorId, v.barruf])).toEqual(
      edicio.valors.map((v) => [v.jugadorId, v.barruf]),
    )
  })
})
