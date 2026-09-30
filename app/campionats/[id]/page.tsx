import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FletxaPosicio, FletxaPunts } from '../../../components/Variacio'
import {
  classificacio,
  estadistiques,
  perRonda,
  type FitxaCampionat,
} from '../../../lib/campionats/fitxa'
import { clientServidor, gestorConnectat } from '../../../lib/supabase/servidor'

export const revalidate = 300

const esUuid = (text: string) => /^[0-9a-f-]{36}$/i.test(text)

async function carrega(id: string): Promise<FitxaCampionat | null> {
  if (!esUuid(id)) return null
  const supabase = await clientServidor()
  const { data } = await supabase.rpc('fitxa_campionat', { p_id: id })
  return (data as FitxaCampionat | null) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const fitxa = await carrega((await params).id)
  return { title: fitxa?.campionat.nom ?? 'Campionat' }
}

const decimal = (valor: number) => valor.toLocaleString('ca-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export default async function Campionat({ params }: { params: Promise<{ id: string }> }) {
  const fitxa = await carrega((await params).id)
  if (!fitxa) notFound()

  const { campionat } = fitxa
  const gestor = await gestorConnectat()
  const files = classificacio(fitxa.jugadors)
  const xifres = estadistiques(fitxa)
  const rondes = perRonda(fitxa.partides)
  const ambBarruf = files.some((f) => f.variacio !== null)

  const tesseles = [
    { etiqueta: 'Participants', valor: String(xifres.participants) },
    { etiqueta: 'Partides', valor: String(xifres.partides) },
    { etiqueta: 'Rondes', valor: String(xifres.rondes) },
    ...(xifres.mitjanaPartida !== null
      ? [{ etiqueta: 'Punts per jugador i partida', valor: String(Math.round(xifres.mitjanaPartida)) }]
      : []),
  ]

  return (
    <div className="space-y-8">
      <div>
        <Link href="/campionats" className="text-sm text-stone-500 underline hover:text-stone-900">
          ← Campionats
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{campionat.nom}</h1>
        <p className="mt-1 text-sm text-stone-600">
          {campionat.data ? new Date(campionat.data).toLocaleDateString('ca-ES') : null}
          {' · '}Temporada {campionat.temporada}
          {campionat.club_organitzador || campionat.organitzador
            ? ` · ${campionat.club_organitzador ?? campionat.organitzador}`
            : null}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          {campionat.primera_edicio ? (
            <>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                Barrufat a l&apos;edició {campionat.primera_edicio}
              </span>
              <a
                href={`/barruf/pdf?edicio=${campionat.primera_edicio}`}
                className="rounded border border-stone-300 px-3 py-1 text-stone-700 hover:border-stone-500"
              >
                PDF del BARRUF {campionat.primera_edicio}
              </a>
            </>
          ) : !campionat.computa_barruf ? (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
              Arxiu: no mou el BARRUF
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
              {campionat.finalitzat ? 'Pendent de publicar' : 'En curs'}
            </span>
          )}
          {gestor ? (
            <Link
              href={`/gestio/campionats/${campionat.id}`}
              className="rounded bg-stone-900 px-3 py-1 text-white hover:bg-stone-700"
            >
              Editar
            </Link>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-4">
        {tesseles.map((t) => (
          <div key={t.etiqueta} className="bg-white px-4 py-3">
            <dt className="text-xs uppercase tracking-wide text-stone-500">{t.etiqueta}</dt>
            <dd className="xifres mt-1 text-2xl font-semibold">{t.valor}</dd>
          </div>
        ))}
      </dl>

      {xifres.ambPunts || xifres.mesPujada ? (
        <ul className="grid gap-3 text-sm sm:grid-cols-2">
          {xifres.millorPuntuacio ? (
            <li className="rounded-lg border border-stone-200 bg-white px-4 py-3">
              <span className="text-stone-500">Millor puntuació:</span>{' '}
              <strong>{xifres.millorPuntuacio.punts}</strong> de {xifres.millorPuntuacio.jugador}
              {xifres.millorPuntuacio.rival ? ` contra ${xifres.millorPuntuacio.rival}` : ''} (ronda{' '}
              {xifres.millorPuntuacio.ronda})
            </li>
          ) : null}
          {xifres.majorVictoria ? (
            <li className="rounded-lg border border-stone-200 bg-white px-4 py-3">
              <span className="text-stone-500">Victòria més àmplia:</span>{' '}
              {xifres.majorVictoria.guanyador} {xifres.majorVictoria.marcador}{' '}
              {xifres.majorVictoria.perdedor} (+{xifres.majorVictoria.diferencia})
            </li>
          ) : null}
          {xifres.partidaMesAlta ? (
            <li className="rounded-lg border border-stone-200 bg-white px-4 py-3">
              <span className="text-stone-500">Partida amb més punts:</span>{' '}
              {xifres.partidaMesAlta.descripcio} ({xifres.partidaMesAlta.total})
            </li>
          ) : null}
          {xifres.mesPujada ? (
            <li className="rounded-lg border border-stone-200 bg-white px-4 py-3">
              <span className="text-stone-500">Qui més ha pujat:</span> {xifres.mesPujada.nom}{' '}
              <strong className="text-emerald-700">+{Math.round(xifres.mesPujada.variacio)}</strong>
            </li>
          ) : null}
        </ul>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Classificació</h2>
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Jugador</th>
                <th className="px-3 py-2 text-right font-medium">V</th>
                <th className="px-3 py-2 text-right font-medium">P</th>
                {xifres.ambPunts ? (
                  <>
                    <th className="px-3 py-2 text-right font-medium">Punts</th>
                    <th className="px-3 py-2 text-right font-medium">Dif.</th>
                  </>
                ) : null}
                {ambBarruf ? (
                  <>
                    <th className="px-3 py-2 text-right font-medium" title="Victòries esperades segons el BARRUF">
                      Esperades
                    </th>
                    <th className="px-3 py-2 text-right font-medium">BARRUF</th>
                    <th className="px-3 py-2 text-right font-medium">Variació</th>
                    <th className="px-3 py-2 text-right font-medium">Posició</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {files.map((f) => (
                <tr key={f.numero} className="hover:bg-stone-50">
                  <td className="xifres px-3 py-1.5 text-stone-400">{f.lloc}</td>
                  <td className="px-3 py-1.5">
                    <Link href={`/jugadors/${f.numero}`} className="font-medium hover:underline">
                      {f.nom}
                    </Link>
                    {f.club ? <span className="ml-2 text-xs text-stone-400">{f.club}</span> : null}
                  </td>
                  <td className="xifres px-3 py-1.5 text-right">{decimal(f.victories)}</td>
                  <td className="xifres px-3 py-1.5 text-right text-stone-600">{f.partides}</td>
                  {xifres.ambPunts ? (
                    <>
                      <td className="xifres px-3 py-1.5 text-right text-stone-600">{f.punts_favor ?? '—'}</td>
                      <td className="xifres px-3 py-1.5 text-right text-stone-600">
                        {f.diferencia === null ? '—' : `${f.diferencia > 0 ? '+' : ''}${f.diferencia}`}
                      </td>
                    </>
                  ) : null}
                  {ambBarruf ? (
                    <>
                      <td className="xifres px-3 py-1.5 text-right text-stone-500">
                        {f.esperanca === null ? '—' : decimal(Number(f.esperanca))}
                      </td>
                      <td className="xifres px-3 py-1.5 text-right">
                        {f.barruf_abans === null ? (
                          '—'
                        ) : (
                          <>
                            <span className="text-stone-400">{Math.round(Number(f.barruf_abans))} → </span>
                            <strong>{Math.round(Number(f.barruf_despres))}</strong>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <FletxaPunts
                          valor={
                            f.barruf_abans === null
                              ? null
                              : Math.round(Number(f.barruf_despres)) - Math.round(Number(f.barruf_abans))
                          }
                        />
                      </td>
                      <td className="xifres px-3 py-1.5 text-right">
                        {f.posicio ? (
                          <span className="inline-flex items-center gap-2">
                            {f.posicio}
                            <FletxaPosicio ara={f.posicio} abans={f.posicio_anterior} />
                          </span>
                        ) : (
                          <span className="text-xs text-stone-400">{f.estat ?? '—'}</span>
                        )}
                      </td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Partides</h2>
        <div className="space-y-2">
          {rondes.map(([ronda, partides]) => (
            <details key={ronda} className="rounded-lg border border-stone-200 bg-white" open={rondes.length <= 3}>
              <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
                Ronda {ronda} <span className="font-normal text-stone-400">· {partides.length} partides</span>
              </summary>
              <ul className="divide-y divide-stone-100 border-t border-stone-100">
                {partides.map((p, i) => {
                  const guanya1 = Number(p.resultat_1) === 1
                  const guanya2 = Number(p.resultat_1) === 0 && p.numero_2 !== null
                  return (
                    <li key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-1.5 text-sm">
                      <Link href={`/jugadors/${p.numero_1}`} className={`text-right hover:underline ${guanya1 ? 'font-semibold' : 'text-stone-600'}`}>
                        {p.jugador_1}
                      </Link>
                      <span className="xifres whitespace-nowrap text-center text-stone-700">
                        {p.numero_2 === null
                          ? 'descansa'
                          : p.punts_1 !== null && p.punts_2 !== null
                            ? `${p.punts_1} – ${p.punts_2}`
                            : Number(p.resultat_1) === 0.5
                              ? '½ – ½'
                              : `${Number(p.resultat_1)} – ${1 - Number(p.resultat_1)}`}
                      </span>
                      {p.numero_2 !== null ? (
                        <Link href={`/jugadors/${p.numero_2}`} className={`hover:underline ${guanya2 ? 'font-semibold' : 'text-stone-600'}`}>
                          {p.jugador_2}
                        </Link>
                      ) : (
                        <span />
                      )}
                    </li>
                  )
                })}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
