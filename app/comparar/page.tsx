import Link from 'next/link'

import { efecte, probabilitat, torneig, type Contendent } from '../../lib/comparativa/prediccio'
import { categoria } from '../../lib/informe/model'
import { clientServidor } from '../../lib/supabase/servidor'
import { COLORS, MAXIM } from '../../lib/comparativa/colors'
import { Selector } from './Selector'

export const metadata = { title: 'Comparar jugadors' }

interface Jugador {
  numero: number
  nom: string
  club: string | null
  barruf: number | null
  estat: string | null
  posicio: number | null
  partides_totals: number | null
  victories_totals: number | null
  partides_temporada: number | null
  victories_temporada: number | null
  darrera_temporada: string | null
  scrabbles: number | null
  partides_scrabbles: number
  punts_mitjans: number | null
  millor_jugada: { mot: string | null; punts: number } | null
}

interface Parella {
  a: number
  b: number
  cara_a_cara: {
    partides: number
    amb_resultat: number
    victories_a: number | null
    darreres: {
      campionat: string
      campionat_id: string
      data: string
      ronda: number
      resultat: number | null
      punts: number | null
      punts_rival: number | null
    }[]
  }
  rivals_comuns: {
    rivals: number
    partides_a: number
    victories_a: number
    partides_b: number
    victories_b: number
    detall: {
      rival: string
      numero: number
      partides_a: number
      victories_a: number
      partides_b: number
      victories_b: number
    }[]
  }
}

interface Comparativa {
  edicio: number
  jugadors: Jugador[]
  evolucio: Record<string, [number, number][]>
  parelles: Parella[]
}

const CATEGORIA = ['Gran Gran Mestre', 'Gran Mestre', 'Mestre', 'Expert', 'Avançat']
const ESTAT: Record<string, string> = { act: 'Actiu', exp: 'Expectativa', inact: 'Inactiu', nov: 'Novell' }
const pct = (v: number, de: number) => (de ? `${Math.round((v / de) * 100)} %` : '—')
const dec = (n: number, d = 1) => n.toLocaleString('ca-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
const amb = (n: number) => (n > 0 ? `+${n}` : String(n))
/** Verd com més probable, vermell com menys. */
const fons = (p: number) =>
  p >= 0.5 ? `rgba(22, 163, 74, ${(p - 0.5) * 0.5})` : `rgba(220, 38, 38, ${(0.5 - p) * 0.5})`

/** El BARRUF de cada jugador edició a edició, en un sol gràfic. */
function Grafic({ series, noms }: { series: [number, [number, number][]][]; noms: Map<number, string> }) {
  const punts = series.flatMap(([, s]) => s)
  if (punts.length === 0) return null
  const [x0, x1] = [Math.min(...punts.map((p) => p[0])), Math.max(...punts.map((p) => p[0]))]
  const [y0, y1] = [Math.min(...punts.map((p) => p[1])) - 20, Math.max(...punts.map((p) => p[1])) + 20]
  const W = 800
  const H = 280
  const M = { e: 44, d: 10, a: 10, b: 24 }
  const x = (v: number) => M.e + ((v - x0) / Math.max(1, x1 - x0)) * (W - M.e - M.d)
  const y = (v: number) => H - M.b - ((v - y0) / Math.max(1, y1 - y0)) * (H - M.a - M.b)
  const marques = Array.from({ length: 5 }, (_, i) => Math.round(y0 + ((y1 - y0) * i) / 4))
  const edicions = Array.from({ length: 6 }, (_, i) => Math.round(x0 + ((x1 - x0) * i) / 5))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolució del BARRUF">
      {marques.map((m) => (
        <g key={m}>
          <line x1={M.e} x2={W - M.d} y1={y(m)} y2={y(m)} stroke="#e7e5e4" />
          <text x={M.e - 6} y={y(m) + 4} textAnchor="end" fontSize="11" fill="#78716c">{m}</text>
        </g>
      ))}
      {edicions.map((e) => (
        <text key={e} x={x(e)} y={H - 6} textAnchor="middle" fontSize="11" fill="#78716c">{e}</text>
      ))}
      {series.map(([numero, s], i) => (
        <polyline
          key={numero}
          fill="none"
          stroke={COLORS[i]}
          strokeWidth="2"
          points={s.map(([e, b]) => `${x(e)},${y(b)}`).join(' ')}
        >
          <title>{noms.get(numero)}</title>
        </polyline>
      ))}
    </svg>
  )
}

export default async function Comparar({ searchParams }: { searchParams: Promise<{ j?: string }> }) {
  const { j } = await searchParams
  const triats = [...new Set((j ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAXIM)

  const supabase = await clientServidor()
  const [{ data: llista }, { data }] = await Promise.all([
    supabase.from('barruf_classificacio').select('jugador_numero, nom_complet, club').order('nom_complet'),
    triats.length >= 2 ? supabase.rpc('comparativa_jugadors', { p_numeros: triats }) : Promise.resolve({ data: null }),
  ])
  const registre = (llista ?? []).map((r) => ({
    numero: r.jugador_numero as number,
    nom: r.nom_complet as string,
    club: (r.club as string | null) ?? null,
  }))
  const c = data as Comparativa | null
  const jugadors = c?.jugadors ?? []
  const color = new Map(jugadors.map((x, i) => [x.numero, COLORS[i]]))
  const nomDe = new Map(jugadors.map((x) => [x.numero, x.nom]))
  const contendents: Contendent[] = jugadors.map((x) => ({
    numero: x.numero,
    barruf: x.barruf === null ? null : Number(x.barruf),
    partidesTotals: x.partides_totals,
  }))
  const perNumero = new Map(contendents.map((x) => [x.numero, x]))
  const simulacio = contendents.length >= 2 ? torneig(contendents) : []

  const Nom = ({ n }: { n: number }) => (
    <span className="inline-flex items-center gap-1.5 font-medium">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color.get(n) }} />
      {nomDe.get(n)}
    </span>
  )

  const files: [string, (x: Jugador) => React.ReactNode][] = [
    ['BARRUF', (x) => (x.barruf === null ? '—' : <strong>{Math.round(Number(x.barruf))}</strong>)],
    ['Posició', (x) => x.posicio ?? '—'],
    ['Categoria', (x) => (x.barruf ? (CATEGORIA[(categoria(Number(x.barruf)) ?? 6) - 1] ?? '—') : '—')],
    ['Estat', (x) => (x.estat ? ESTAT[x.estat] : '—')],
    ['Club', (x) => x.club ?? '—'],
    ['Partides', (x) => x.partides_totals ?? 0],
    ['% victòries', (x) => pct(Number(x.victories_totals ?? 0), x.partides_totals ?? 0)],
    ['Temporada actual', (x) =>
      x.partides_temporada ? `${pct(Number(x.victories_temporada), x.partides_temporada)} de ${x.partides_temporada}` : '—'],
    ['Punts per partida', (x) => x.punts_mitjans ?? '—'],
    ['Scrabbles per partida', (x) => (x.partides_scrabbles ? dec(Number(x.scrabbles) / x.partides_scrabbles, 2) : '—')],
    ['Millor jugada', (x) => (x.millor_jugada ? `${x.millor_jugada.mot ?? '—'} (${x.millor_jugada.punts})` : '—')],
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comparar jugadors</h1>
        <p className="mt-1 max-w-3xl text-sm text-stone-600">
          Trieu de 2 a {MAXIM} jugadors. Les prediccions fan servir la mateixa fórmula que el BARRUF
          per valorar cada partida: la probabilitat de guanyar depèn només de la diferència de BARRUF.
          Valen també per a jugadors que no s’han enfrontat mai.
        </p>
      </div>

      <Selector registre={registre} triats={triats} />

      {c && jugadors.length >= 2 ? (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Fitxes</h2>
            <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="px-3 py-2" />
                    {jugadors.map((x) => (
                      <th key={x.numero} className="px-3 py-2 text-left">
                        <Link href={`/jugadors/${x.numero}`} className="hover:underline">
                          <Nom n={x.numero} />
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {files.map(([etiqueta, valor]) => (
                    <tr key={etiqueta}>
                      <td className="whitespace-nowrap px-3 py-1.5 text-xs uppercase tracking-wide text-stone-500">{etiqueta}</td>
                      {jugadors.map((x) => (
                        <td key={x.numero} className="xifres px-3 py-1.5">{valor(x)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Qui guanyaria?</h2>
            <p className="text-sm text-stone-600">
              Probabilitat que el jugador de la fila guanyi el de la columna en una partida.
            </p>
            <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="px-3 py-2" />
                    {jugadors.map((x) => (
                      <th key={x.numero} className="px-3 py-2 text-center"><Nom n={x.numero} /></th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {jugadors.map((fila) => (
                    <tr key={fila.numero}>
                      <td className="whitespace-nowrap px-3 py-2"><Nom n={fila.numero} /></td>
                      {jugadors.map((col) => {
                        if (col.numero === fila.numero) return <td key={col.numero} className="px-3 py-2 text-center text-stone-300">—</td>
                        const p = probabilitat(perNumero.get(fila.numero)!, perNumero.get(col.numero)!)
                        return (
                          <td
                            key={col.numero}
                            className="xifres px-3 py-2 text-center font-medium"
                            style={{ backgroundColor: fons(p) }}
                          >
                            {Math.round(p * 100)} %
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {jugadors.length >= 3 ? (
              <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
                <table className="min-w-full text-sm">
                  <caption className="px-4 pt-3 text-left text-sm font-medium">
                    Si juguessin un torneig entre ells, tots contra tots
                    <span className="block text-xs font-normal text-stone-500">10.000 torneigs simulats</span>
                  </caption>
                  <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Jugador</th>
                      <th className="px-4 py-2 text-right font-medium">Victòries esperades</th>
                      <th className="px-4 py-2 text-right font-medium">Probabilitat de quedar primer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {[...simulacio].sort((a, b) => b.primer - a.primer).map((r) => (
                      <tr key={r.numero}>
                        <td className="px-4 py-2"><Nom n={r.numero} /></td>
                        <td className="xifres px-4 py-2 text-right">{dec(r.esperades)} de {jugadors.length - 1}</td>
                        <td className="xifres px-4 py-2 text-right font-semibold">{dec(r.primer * 100)} %</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Parella a parella</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {c.parelles.map((par) => {
                const a = perNumero.get(par.a)!
                const b = perNumero.get(par.b)!
                const p = probabilitat(a, b)
                const ea = efecte(a, b)
                const eb = efecte(b, a)
                const cc = par.cara_a_cara
                const rc = par.rivals_comuns
                return (
                  <div key={`${par.a}-${par.b}`} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 text-sm">
                    <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                      <Nom n={par.a} /> <span className="text-stone-400">contra</span> <Nom n={par.b} />
                    </h3>

                    <div>
                      <div className="flex h-2.5 overflow-hidden rounded-full">
                        <div style={{ width: `${p * 100}%`, backgroundColor: color.get(par.a) }} />
                        <div style={{ width: `${(1 - p) * 100}%`, backgroundColor: color.get(par.b) }} />
                      </div>
                      <p className="mt-1 flex justify-between text-xs text-stone-600">
                        <span>{Math.round(p * 100)} %</span>
                        <span>{Math.round((1 - p) * 100)} %</span>
                      </p>
                      <p className="text-xs text-stone-500">
                        Si guanya {nomDe.get(par.a)}: {amb(ea.guanya)} / {amb(eb.perd)}. Si guanya {nomDe.get(par.b)}:{' '}
                        {amb(ea.perd)} / {amb(eb.guanya)}.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Cara a cara</h4>
                      {cc.partides === 0 ? (
                        <p className="text-stone-500">No s’han enfrontat mai.</p>
                      ) : (
                        <>
                          <p>
                            {cc.partides} partides
                            {cc.amb_resultat
                              ? `: ${dec(Number(cc.victories_a ?? 0))} – ${dec(cc.amb_resultat - Number(cc.victories_a ?? 0))} (${pct(Number(cc.victories_a ?? 0), cc.amb_resultat)} per a ${nomDe.get(par.a)}; la fórmula en preveia el ${Math.round(p * 100)} %)`
                              : ' (sense resultats coneguts)'}
                          </p>
                          <ul className="mt-1 space-y-0.5 text-xs text-stone-600">
                            {cc.darreres.map((g, i) => (
                              <li key={i}>
                                <Link href={`/campionats/${g.campionat_id}`} className="hover:underline">{g.campionat}</Link>
                                {`, ronda ${g.ronda}: `}
                                {g.punts !== null && g.punts_rival !== null
                                  ? `${g.punts} – ${g.punts_rival}`
                                  : g.resultat === null ? 'resultat desconegut' : g.resultat === 1 ? 'guanya' : g.resultat === 0 ? 'perd' : 'empat'}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Rivals comuns</h4>
                      {!rc || rc.rivals === 0 ? (
                        <p className="text-stone-500">No tenen rivals en comú amb resultats coneguts.</p>
                      ) : (
                        <>
                          <p>
                            Contra els mateixos {rc.rivals} rivals: {nomDe.get(par.a)} {pct(Number(rc.victories_a), rc.partides_a)} ·{' '}
                            {nomDe.get(par.b)} {pct(Number(rc.victories_b), rc.partides_b)}
                          </p>
                          <table className="mt-1 w-full text-xs">
                            <tbody className="divide-y divide-stone-100">
                              {rc.detall.map((d) => (
                                <tr key={d.numero}>
                                  <td className="py-0.5">
                                    <Link href={`/jugadors/${d.numero}`} className="hover:underline">{d.rival}</Link>
                                  </td>
                                  <td className="xifres py-0.5 text-right" style={{ color: color.get(par.a) }}>
                                    {dec(Number(d.victories_a), 1)}/{d.partides_a}
                                  </td>
                                  <td className="xifres py-0.5 text-right" style={{ color: color.get(par.b) }}>
                                    {dec(Number(d.victories_b), 1)}/{d.partides_b}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Evolució del BARRUF</h2>
            <p className="text-sm text-stone-600">El BARRUF de cada jugador a cada edició, des del 2014.</p>
            <div className="rounded-lg border border-stone-200 bg-white p-3">
              <Grafic
                series={jugadors.map((x) => [x.numero, c.evolucio[String(x.numero)] ?? []] as [number, [number, number][]])}
                noms={nomDe}
              />
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
