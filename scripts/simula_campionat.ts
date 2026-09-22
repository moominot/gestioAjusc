/**
 * Simula l'efecte d'un campionat sobre el BARRUF, sense desar-hi res.
 *
 * Un campionat es barrufa quan s'acaba, mai per trams. Aquesta eina serveix per
 * veure abans de publicar què passarà, i per comprovar campionats en curs.
 *
 * Ús:
 *   npx vite-node scripts/simula_campionat.ts -- <directori amb .trn, .sco i .ini>
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { calculaCampionat, estatInicial } from '../lib/barruf/motor'
import type { EstatBarruf, VariacioBarruf } from '../lib/barruf/tipus'
import { resolNoms, resumeix, type JugadorRegistre } from '../lib/importacio/resolucio'
import { aEntradaDelMotor, llegeixTorneig } from '../lib/importacio/torneig'

import llavor from '../lib/importacio/__fixtures__/registre-llavor.json'

function trobaFitxer(directori: string, extensio: string): string | undefined {
  return readdirSync(directori).find((nom) => nom.toLowerCase().endsWith(extensio))
}

function main(): void {
  const directori = process.argv[2]
  if (!directori) {
    console.error('Ús: npx vite-node scripts/simula_campionat.ts -- <directori>')
    process.exit(1)
  }

  const nomTrn = trobaFitxer(directori, '.trn')
  const nomSco = trobaFitxer(directori, '.sco')
  const nomIni = trobaFitxer(directori, '.ini')
  if (!nomTrn || !nomSco) {
    console.error(`A ${directori} hi falta el .trn o el .sco`)
    process.exit(1)
  }

  const torneig = llegeixTorneig({
    trn: new Uint8Array(readFileSync(join(directori, nomTrn))),
    sco: new Uint8Array(readFileSync(join(directori, nomSco))),
    ini: nomIni ? readFileSync(join(directori, nomIni), 'latin1') : undefined,
  })

  const jugadors: JugadorRegistre[] = llavor.jugadors.map((j) => ({
    id: `j${j.numero}`,
    numero: j.numero,
    nomComplet: j.nomComplet,
    barruf: j.barruf,
  }))

  const estatPrevi = new Map<string, EstatBarruf>(
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

  const resolts = resolNoms(
    torneig.participants.map((p) => ({
      origen: p,
      nom: p.nomComplet,
      puntuacioInicial: p.puntuacioInicial,
    })),
    { jugadors, alies: [] },
  )

  console.log(`\n${torneig.info?.nom ?? directori}`)
  console.log(`Organitza: ${torneig.info?.organitzador || '(no consta)'}`)
  console.log(
    `Rondes: ${torneig.rondesJugades.length} jugades` +
      (torneig.info?.rondesPrevistes ? ` de ${torneig.info.rondesPrevistes} previstes` : '') +
      (torneig.rondesPendents.length > 0
        ? ` · pendents: ${torneig.rondesPendents.join(', ')}`
        : ''),
  )
  console.log(`Partides: ${torneig.partides.length} · Participants: ${torneig.participants.length}`)

  const resum = resumeix(resolts)
  console.log(
    `\nResolució de noms: ${resum.exactes} exactes, ${resum.perAlies} per àlies, ` +
      `${resum.dubtosos} dubtosos, ${resum.nous} altes noves`,
  )

  const correspondencia = new Map<number, string>()
  const pendents: string[] = []
  for (const resolt of resolts) {
    const { resolucio } = resolt
    if (resolucio.tipus === 'exacte' || resolucio.tipus === 'alies') {
      correspondencia.set(resolt.origen.id, resolucio.jugador.id)
      continue
    }
    const millor = resolucio.candidats[0]
    if (millor?.unicAmbAquestaPuntuacio) {
      correspondencia.set(resolt.origen.id, millor.jugador.id)
      pendents.push(
        `  ? ${resolt.nom} → ${millor.jugador.nomComplet} ` +
          `(puntuació ${resolt.origen.puntuacioInicial}, única al registre) — CAL CONFIRMAR`,
      )
    } else {
      correspondencia.set(resolt.origen.id, `nou:${resolt.nomNormalitzat}`)
      pendents.push(`  + ${resolt.nom} → alta nova (puntuació ${resolt.origen.puntuacioInicial})`)
    }
  }
  if (pendents.length > 0) {
    console.log('\nDecisions que al sistema real pren el gestor:')
    for (const linia of pendents) console.log(linia)
  }

  const entrada = aEntradaDelMotor(torneig, correspondencia, {
    campionatId: 'simulacio',
    temporadaCodi: '2025-26',
  })
  const variacions = calculaCampionat(entrada, estatPrevi)

  const nomDe = new Map(jugadors.map((j) => [j.id, j.nomComplet]))
  for (const resolt of resolts) {
    const id = correspondencia.get(resolt.origen.id)
    if (id && !nomDe.has(id)) nomDe.set(id, `${resolt.nom} (nou)`)
  }

  const ordenades = [...variacions].sort((a, b) => b.barrufDespres - a.barrufDespres)
  const fila = (v: VariacioBarruf, posicio: number) =>
    [
      String(posicio).padStart(3),
      (nomDe.get(v.jugadorId) ?? v.jugadorId).padEnd(24).slice(0, 24),
      v.barrufAbans.toFixed(0).padStart(5),
      `${v.variacio >= 0 ? '+' : ''}${v.variacio.toFixed(1)}`.padStart(7),
      v.barrufDespres.toFixed(0).padStart(6),
      String(v.partides).padStart(4),
      v.victories.toFixed(1).padStart(6),
      v.esperanca.toFixed(2).padStart(7),
      String(v.factorK).padStart(3),
    ].join(' ')

  console.log('\nSIMULACIÓ — no es desa res\n')
  console.log(
    ['pos', 'jugador'.padEnd(24), 'abans', 'variac.', 'després', 'part', 'vict', 'esper.', '  K'].join(
      ' ',
    ),
  )
  console.log('-'.repeat(82))
  ordenades.forEach((v, i) => console.log(fila(v, i + 1)))

  const suma = variacions.reduce((total, v) => total + v.variacio, 0)
  const puja = variacions.filter((v) => v.variacio > 0).length
  console.log('-'.repeat(82))
  console.log(
    `${variacions.length} jugadors amb variació · ${puja} pugen, ${variacions.length - puja} baixen` +
      ` · suma ${suma >= 0 ? '+' : ''}${suma.toFixed(1)}`,
  )
}

main()
