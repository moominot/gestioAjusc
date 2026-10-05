import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FletxaPosicio, FletxaPunts } from '../../../components/Variacio'
import {
  classificacio,
  estadistiques,
  perRonda,
  type FitxaCampionat,
  type PartidaCampionat,
} from '../../../lib/campionats/fitxa'
import { DadesLliures } from '../../../components/DadesLliures'
import type { InformeCru } from '../../../lib/informe/model'
import type { DadesPrompt } from '../../../lib/campionats/promptResum'
import { ResumIA } from './ResumIA'
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

/**
 * Les dades del prompt del resum. L'estat i la categoria d'abans i de després
 * surten de l'edició del BARRUF que va computar el campionat, comparada amb
 * l'anterior; si encara no s'ha publicat, només es compara el BARRUF abans i
 * després del campionat i l'estat queda en blanc.
 */
async function carregaDadesPrompt(
  fitxa: FitxaCampionat,
  classificacioCampionat: DadesPrompt['classificacio'],
  estadistiquesCampionat: DadesPrompt['estadistiques'],
  notes: string,
): Promise<DadesPrompt> {
  const edicio = fitxa.campionat.primera_edicio
  let informe: InformeCru | null = null
  if (edicio) {
    const supabase = await clientServidor()
    informe = ((await supabase.rpc('informe_barruf', { p_numero: edicio })).data as InformeCru | null) ?? null
  }
  const files = new Map((informe?.files ?? []).map((f) => [f.numero, f]))
  return {
    campionat: fitxa.campionat,
    notes,
    classificacio: classificacioCampionat,
    estadistiques: estadistiquesCampionat,
    jugadors: fitxa.jugadors.map((j) => {
      const f = files.get(j.numero)
      return f
        ? {
            nom: j.nom,
            estatAbans: f.anterior ? (f.anterior.estat as DadesPrompt['jugadors'][number]['estatAbans']) : null,
            estatDespres: f.estat,
            barrufAbans: f.anterior && Number(f.anterior.barruf) > 0 ? Number(f.anterior.barruf) : null,
            barrufDespres: Number(f.barruf),
          }
        : {
            nom: j.nom,
            estatAbans: null,
            estatDespres: null,
            barrufAbans: j.barruf_abans === null ? null : Number(j.barruf_abans),
            barrufDespres: j.barruf_despres === null ? null : Number(j.barruf_despres),
          }
    }),
  }
}

const decimal = (valor: number) => valor.toLocaleString('ca-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export default async function Campionat({ params }: { params: Promise<{ id: string }> }) {
  const fitxa = await carrega((await params).id)
  if (!fitxa) notFound()

  const { campionat } = fitxa
  const supabase = await clientServidor()
  // Les dades lliures (enllaços al full, taula, comentaris...), si n'hi ha.
  const [gestor, { data: lliuresCampionat }, { data: lliuresPartides }] = await Promise.all([
    gestorConnectat(),
    supabase.from('campionats').select('dades, notes').eq('id', campionat.id).maybeSingle(),
    supabase.from('partides').select('id, dades').eq('campionat_id', campionat.id).not('dades', 'is', null),
  ])
  const dadesPartida = new Map((lliuresPartides ?? []).map((p) => [p.id as string, p.dades as Record<string, unknown>]))
  const files = classificacio(fitxa.jugadors)
  const xifres = estadistiques(fitxa)
  const rondes = perRonda(fitxa.partides)
  const dadesPrompt = gestor ? await carregaDadesPrompt(fitxa, files, xifres, (lliuresCampionat?.notes as string | null) ?? '') : null
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
          {dadesPrompt ? <ResumIA dades={dadesPrompt} /> : null}
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

      {xifres.ambPunts || xifres.mesPujada || xifres.ambJugades ? (
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
          {xifres.millorJugada ? (
            <li className="rounded-lg border border-stone-200 bg-white px-4 py-3">
              <span className="text-stone-500">Millor jugada:</span>{' '}
              {xifres.millorJugada.mot ? <strong className="tracking-wide">{xifres.millorJugada.mot}</strong> : null}{' '}
              ({xifres.millorJugada.punts} punts) de {xifres.millorJugada.jugador}, ronda{' '}
              {xifres.millorJugada.ronda}
            </li>
          ) : null}
          {xifres.millorLletra ? (
            <li className="rounded-lg border border-stone-200 bg-white px-4 py-3">
              <span className="text-stone-500">Millor jugada amb lletra especial:</span>{' '}
              {xifres.millorLletra.mot ? <strong className="tracking-wide">{xifres.millorLletra.mot}</strong> : null}{' '}
              ({xifres.millorLletra.punts} punts) de {xifres.millorLletra.jugador}, ronda{' '}
              {xifres.millorLletra.ronda}
            </li>
          ) : null}
          {xifres.mesScrabbles ? (
            <li className="rounded-lg border border-stone-200 bg-white px-4 py-3">
              <span className="text-stone-500">Més scrabbles:</span> {xifres.mesScrabbles.jugador}{' '}
              <strong>{xifres.mesScrabbles.scrabbles}</strong>
            </li>
          ) : null}
        </ul>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold">
          {ambBarruf ? 'Participants i efecte al BARRUF' : 'Participants'}
        </h2>
        <p className="mb-3 mt-1 max-w-3xl text-sm text-stone-600">
          Ordenats per victòries i, a igualtat, per diferència de punts. No és necessàriament la
          classificació oficial del campionat, que pot tenir altres criteris de desempat.
          {ambBarruf
            ? ` Les columnes de la dreta són el BARRUF: les victòries esperades, el BARRUF abans i després del campionat, la variació i la posició al BARRUF ${campionat.primera_edicio ?? ''}.`
            : null}
        </p>
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2 font-medium" title="Ordre per victòries i diferència de punts">#</th>
                <th className="px-3 py-2 font-medium">Jugador</th>
                <th className="px-3 py-2 text-right font-medium">V</th>
                <th className="px-3 py-2 text-right font-medium">P</th>
                {xifres.ambPunts ? (
                  <>
                    <th className="px-3 py-2 text-right font-medium">Punts</th>
                    <th className="px-3 py-2 text-right font-medium">Dif.</th>
                  </>
                ) : null}
                {xifres.ambJugades ? (
                  <>
                    <th className="px-3 py-2 text-right font-medium" title="Scrabbles">Scr.</th>
                    <th className="px-3 py-2 font-medium">Millor jugada</th>
                    <th className="px-3 py-2 font-medium">Lletra especial</th>
                  </>
                ) : null}
                {ambBarruf ? (
                  <>
                    <th className="px-3 py-2 text-right font-medium" title="Victòries esperades segons el BARRUF">
                      Esperades
                    </th>
                    <th className="px-3 py-2 text-right font-medium">BARRUF</th>
                    <th className="px-3 py-2 text-right font-medium">Variació</th>
                    <th className="px-3 py-2 text-right font-medium" title="Posició al BARRUF en què es va computar el campionat">Posició BARRUF</th>
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
                  {xifres.ambJugades ? (
                    <>
                      <td className="xifres px-3 py-1.5 text-right text-stone-600">{f.scrabbles ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-stone-600">
                        <Jugada mot={f.mot ?? null} punts={f.punts_mot ?? null} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-stone-600">
                        <Jugada mot={f.mot_lletra ?? null} punts={f.punts_lletra ?? null} />
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

      {lliuresCampionat?.dades ? (
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <DadesLliures dades={lliuresCampionat.dades as Record<string, unknown>} />
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Partides</h2>
          {/* Un <a> i no un <Link>: és un fitxer, no una pàgina de l'aplicació. */}
          <a
            href={`/campionats/${campionat.id}/xlsx`}
            className="rounded border border-stone-300 px-3 py-1 text-sm text-stone-700 hover:border-stone-500"
          >
            Descarrega en .xlsx
          </a>
        </div>
        <div className="space-y-2">
          {rondes.map(([ronda, partides]) => (
            <details key={ronda} className="rounded-lg border border-stone-200 bg-white" open={rondes.length <= 3}>
              <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
                Ronda {ronda} <span className="font-normal text-stone-400">· {partides.length} partides</span>
              </summary>
              <ul className="divide-y divide-stone-100 border-t border-stone-100">
                {partides.map((p, i) => {
                  const conegut = p.resultat_1 !== null
                  const guanya1 = conegut && Number(p.resultat_1) === 1
                  const guanya2 = conegut && Number(p.resultat_1) === 0 && p.numero_2 !== null
                  return (
                    <li key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-1.5 text-sm">
                      <span className="text-right">
                        <Link href={`/jugadors/${p.numero_1}`} className={`hover:underline ${guanya1 ? 'font-semibold' : 'text-stone-600'}`}>
                          {p.jugador_1}
                        </Link>
                        <DetallCostat partida={p} costat={1} />
                      </span>
                      <span className="xifres whitespace-nowrap text-center text-stone-700">
                        {p.numero_2 === null
                          ? 'descansa'
                          : p.punts_1 !== null && p.punts_2 !== null
                            ? `${p.punts_1} – ${p.punts_2}`
                            : !conegut
                              ? 'contra'
                              : Number(p.resultat_1) === 0.5
                              ? '½ – ½'
                              : `${Number(p.resultat_1)} – ${1 - Number(p.resultat_1)}`}
                      </span>
                      {p.numero_2 !== null ? (
                        <span>
                          <Link href={`/jugadors/${p.numero_2}`} className={`hover:underline ${guanya2 ? 'font-semibold' : 'text-stone-600'}`}>
                            {p.jugador_2}
                          </Link>
                          <DetallCostat partida={p} costat={2} />
                        </span>
                      ) : (
                        <span />
                      )}
                      {dadesPartida.has(p.id) ? (
                        <span className="col-span-3 -mt-1">
                          <DadesLliures dades={dadesPartida.get(p.id)} compacte />
                        </span>
                      ) : null}
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

/** Un mot amb els seus punts, o un guió si no se'n té. */
function Jugada({ mot, punts }: { mot: string | null; punts: number | null }) {
  if (punts === null && !mot) return <span className="text-stone-300">—</span>
  return (
    <>
      {mot ? <span className="tracking-wide">{mot}</span> : null}
      {punts !== null ? <span className="xifres ml-1 text-stone-400">{punts}</span> : null}
    </>
  )
}

/** Scrabbles i millors jugades d'un jugador en una partida, en petit sota el nom. */
function DetallCostat({ partida: p, costat }: { partida: PartidaCampionat; costat: 1 | 2 }) {
  const [scrabbles, mot, punts, lletra, puntsLletra] =
    costat === 1
      ? [p.scrabbles_1, p.mot_1, p.punts_mot_1, p.mot_lletra_1, p.punts_lletra_1]
      : [p.scrabbles_2, p.mot_2, p.punts_mot_2, p.mot_lletra_2, p.punts_lletra_2]
  const parts = [
    scrabbles !== null && scrabbles !== undefined ? `${scrabbles} scr.` : null,
    mot || punts ? [mot, punts].filter((x) => x !== null && x !== undefined).join(' ') : null,
    lletra || puntsLletra ? [lletra, puntsLletra].filter((x) => x !== null && x !== undefined).join(' ') : null,
  ].filter(Boolean)
  if (parts.length === 0) return null
  return <span className="block text-xs text-stone-400">{parts.join(' · ')}</span>
}
