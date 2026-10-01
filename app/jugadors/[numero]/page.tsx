import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { clientServidor, gestorConnectat } from '../../../lib/supabase/servidor'
import { PartidesJugador } from './PartidesJugador'
import {
  ETIQUETA_ESTAT,
  type FilaEnfrontament,
  type FilaEvolucio,
  type FitxaJugador,
} from '../../../lib/supabase/tipus'

export const revalidate = 300

const nombre = (valor: string | number | null, decimals = 0) =>
  valor === null ? '—' : Number(valor).toFixed(decimals)

export async function generateMetadata({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params
  const supabase = await clientServidor()
  const { data } = await supabase
    .from('jugador_fitxa')
    .select('nom_complet')
    .eq('numero', Number(numero))
    .single()
  return { title: data?.nom_complet ?? 'Jugador' }
}

export default async function Jugador({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params
  const identificador = Number(numero)
  if (!Number.isInteger(identificador)) notFound()

  const supabase = await clientServidor()
  const { data: fitxa } = await supabase
    .from('jugador_fitxa')
    .select('*')
    .eq('numero', identificador)
    .single<FitxaJugador>()

  if (!fitxa) {
    // Un número fusionat porta a la fitxa que ha quedat.
    const { data: bo } = await supabase.rpc('jugador_fusionat_a', { p_numero: identificador })
    if (typeof bo === 'number') redirect(`/jugadors/${bo}`)
    notFound()
  }

  const gestor = await gestorConnectat()

  const [{ data: evolucio }, { data: partides }, { data: jugadesCrues }] = await Promise.all([
    supabase
      .from('jugador_evolucio')
      .select('*')
      .eq('jugador_numero', identificador)
      // En l'ordre de la cadena: molts campionats antics comparteixen data.
      .order('edicio', { ascending: false, nullsFirst: true })
      .order('data', { ascending: false })
      .returns<FilaEvolucio[]>(),
    supabase
      .from('enfrontaments')
      .select('*')
      .eq('jugador_numero', identificador)
      .order('edicio', { ascending: false, nullsFirst: true })
      .order('data', { ascending: false })
      .order('campionat_id')
      .order('ronda', { ascending: false })
      .returns<FilaEnfrontament[]>(),
    supabase.rpc('jugades_jugador', { p_numero: identificador }),
  ])
  const jugades = jugadesCrues as Jugades | null
  const ambJugades = !!jugades && (jugades.millors.length > 0 || jugades.lletra.length > 0 || jugades.scrabbles.partides > 0)

  const dades = [
    { etiqueta: 'BARRUF', valor: nombre(fitxa.barruf) },
    { etiqueta: 'Categoria', valor: fitxa.categoria ?? '—' },
    { etiqueta: 'Posició', valor: fitxa.posicio ?? '—' },
    { etiqueta: 'Estat', valor: fitxa.estat ? ETIQUETA_ESTAT[fitxa.estat] : '—' },
    { etiqueta: 'Partides', valor: fitxa.partides_totals ?? 0 },
    { etiqueta: 'Victòries', valor: nombre(fitxa.victories_totals, 1) },
    {
      etiqueta: '% victòries',
      valor: fitxa.percentatge_victories ? `${nombre(fitxa.percentatge_victories, 1)} %` : '—',
    },
    { etiqueta: 'Darrera temporada', valor: fitxa.darrera_temporada ?? '—' },
  ]

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-stone-500">Jugador núm. {fitxa.numero}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{fitxa.nom_complet}</h1>
          {gestor ? (
            <Link
              href={`/gestio/jugadors/${fitxa.numero}`}
              className="rounded bg-stone-900 px-3 py-1 text-sm text-white hover:bg-stone-700"
            >
              Editar
            </Link>
          ) : null}
        </div>
        {fitxa.club ? (
          <p className="mt-1 text-stone-600">
            <Link href={`/clubs/${encodeURIComponent(fitxa.club)}`} className="hover:underline">
              {fitxa.club}
            </Link>
          </p>
        ) : null}
      </header>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-4">
        {dades.map((dada) => (
          <div key={dada.etiqueta} className="bg-white px-4 py-3">
            <dt className="text-xs uppercase tracking-wide text-stone-500">{dada.etiqueta}</dt>
            <dd className="xifres mt-1 text-lg font-semibold">{dada.valor}</dd>
          </div>
        ))}
      </dl>

      {ambJugades && jugades ? <MillorsJugades j={jugades} /> : null}

      <section>
        <h2 className="text-lg font-semibold">Evolució del BARRUF</h2>
        <p className="mt-1 text-sm text-stone-600">
          Per què la puntuació és la que és: cada campionat, amb les victòries que hi va fer
          contra les que s&apos;hi esperaven.
        </p>
        {evolucio && evolucio.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded-lg border border-stone-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3 font-medium" title="Edició del BARRUF on es va computar">Núm.</th>
                  <th className="px-4 py-3 font-medium">Campionat</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 text-right font-medium">Abans</th>
                  <th className="px-4 py-3 text-right font-medium">Part.</th>
                  <th className="px-4 py-3 text-right font-medium">Vict.</th>
                  <th className="px-4 py-3 text-right font-medium">Esperades</th>
                  <th className="px-4 py-3 text-right font-medium">K</th>
                  <th className="px-4 py-3 text-right font-medium">Variació</th>
                  <th className="px-4 py-3 text-right font-medium">BARRUF</th>
                  <th className="px-4 py-3 text-right font-medium" title="Partides totals després del campionat">PT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {evolucio.map((fila) => {
                  const variacio = Number(fila.variacio)
                  return (
                    <tr key={fila.campionat_id}>
                      <td className="xifres px-4 py-2 text-stone-500">
                        {fila.edicio ? (
                          <a href={`/barruf/pdf?edicio=${fila.edicio}`} className="hover:underline">
                            {fila.edicio}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2 font-medium">
                        <Link href={`/campionats/${fila.campionat_id}`} className="hover:underline">
                          {fila.campionat}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-stone-600">
                        {new Date(fila.data).toLocaleDateString('ca-ES')}
                      </td>
                      <td className="xifres px-4 py-2 text-right text-stone-500">
                        {nombre(fila.barruf_abans)}
                      </td>
                      <td className="xifres px-4 py-2 text-right">{fila.partides}</td>
                      <td className="xifres px-4 py-2 text-right">{nombre(fila.victories, 1)}</td>
                      <td className="xifres px-4 py-2 text-right text-stone-500">
                        {nombre(fila.esperanca, 2)}
                      </td>
                      <td className="xifres px-4 py-2 text-right text-stone-500">
                        {fila.factor_k}
                      </td>
                      <td
                        className={`xifres px-4 py-2 text-right font-medium ${
                          variacio >= 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {variacio >= 0 ? '+' : ''}
                        {variacio.toFixed(1)}
                      </td>
                      <td className="xifres px-4 py-2 text-right font-semibold">
                        {nombre(fila.barruf_despres)}
                      </td>
                      <td className="xifres px-4 py-2 text-right text-stone-500">
                        {fila.partides_totals ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-stone-500">
            Encara no ha jugat cap campionat barrufat des que es porta aquest registre.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Partides</h2>
        <p className="mt-1 text-sm text-stone-600">
          Filtreu per rival, temporada o campionat: les xifres són les de les partides que quedin.
        </p>
        <PartidesJugador partides={partides ?? []} />
      </section>
    </div>
  )
}

interface Jugada {
  mot: string | null
  punts: number
  campionat: string
  campionat_id: string
  data: string
  ronda: number
  rival: string
  rival_numero: number
}

interface Jugades {
  millors: Jugada[]
  lletra: Jugada[]
  scrabbles: { total: number; partides: number; record: number | null }
  record_scrabbles: { scrabbles: number; campionat: string; campionat_id: string; ronda: number; rival: string } | null
}

function LlistaJugades({ titol, llista }: { titol: string; llista: Jugada[] }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <h3 className="border-b border-stone-200 px-4 py-2 text-sm font-semibold">{titol}</h3>
      {llista.length === 0 ? (
        <p className="px-4 py-2 text-sm text-stone-500">Sense dades.</p>
      ) : (
        <ol className="divide-y divide-stone-100 text-sm">
          {llista.map((j, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 px-4 py-1.5">
              <span>
                <span className="font-semibold tracking-wide">{j.mot ?? '—'}</span>
                <span className="ml-2 text-xs text-stone-500">
                  contra{' '}
                  <Link href={`/jugadors/${j.rival_numero}`} className="hover:underline">
                    {j.rival}
                  </Link>
                  {' · '}
                  <Link href={`/campionats/${j.campionat_id}`} className="hover:underline">
                    {j.campionat}
                  </Link>
                  , ronda {j.ronda}
                </span>
              </span>
              <span className="xifres whitespace-nowrap font-semibold">{j.punts}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function MillorsJugades({ j }: { j: Jugades }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Millors jugades</h2>
      <p className="text-sm text-stone-600">
        De les partides que en tenen les dades registrades.
        {j.scrabbles.partides > 0
          ? ` ${j.scrabbles.total} scrabbles en ${j.scrabbles.partides} partides (${(j.scrabbles.total / j.scrabbles.partides).toLocaleString('ca-ES', { maximumFractionDigits: 2 })} per partida).`
          : null}
        {j.record_scrabbles
          ? ` Rècord: ${j.record_scrabbles.scrabbles} en una partida, contra ${j.record_scrabbles.rival} (${j.record_scrabbles.campionat}).`
          : null}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <LlistaJugades titol="Millor jugada" llista={j.millors} />
        <LlistaJugades titol="Millor jugada amb lletra especial" llista={j.lletra} />
      </div>
    </section>
  )
}
