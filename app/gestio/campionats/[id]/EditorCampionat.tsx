'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'

import { CampSuggerit } from '../../../../components/CampSuggerit'
import { perRonda, type PartidaCampionat } from '../../../../lib/campionats/fitxa'
import { desaCampionat, desaPartida, type DadesEditables } from '../accions'

const camp = 'mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm'

export function EditorCampionat({
  id,
  publicatA,
  inicial,
  partides,
  clubs,
  temporades,
}: {
  id: string
  publicatA: number | null
  inicial: DadesEditables
  partides: PartidaCampionat[]
  clubs: string[]
  temporades: string[]
}) {
  const [dades, setDades] = useState(inicial)
  const [missatge, setMissatge] = useState<{ ok: boolean; text: string } | null>(null)
  const [desant, comença] = useTransition()
  const [resultatsTocats, setResultatsTocats] = useState(false)

  const canvia = <K extends keyof DadesEditables>(clau: K, valor: DadesEditables[K]) =>
    setDades((d) => ({ ...d, [clau]: valor }))

  const surtDeLaCadena =
    publicatA !== null && (inicial.computaBarruf !== dades.computaBarruf || inicial.finalitzat !== dades.finalitzat)

  function desa() {
    setMissatge(null)
    comença(async () => {
      const r = await desaCampionat(id, dades)
      setMissatge(r.ok ? { ok: true, text: 'Desat.' } : { ok: false, text: r.error })
    })
  }

  return (
    <div className="space-y-8">
      {publicatA !== null && (resultatsTocats || surtDeLaCadena) ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Aquest campionat ja és al BARRUF {publicatA}. Les edicions publicades no es toquen: el canvi
          entrarà al BARRUF quan{' '}
          <Link href="/gestio/publicar" className="underline">
            publiqueu una edició nova
          </Link>
          , que rejugarà la cadena sencera amb les dades corregides.
        </p>
      ) : null}

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold">Dades del campionat</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            Nom
            <input className={camp} value={dades.nom} onChange={(e) => canvia('nom', e.target.value)} />
          </label>
          <label className="text-sm">
            Data
            <input type="date" className={camp} value={dades.data} onChange={(e) => canvia('data', e.target.value)} />
          </label>
          <label className="text-sm">
            Temporada
            <select className={camp} value={dades.temporadaCodi} onChange={(e) => canvia('temporadaCodi', e.target.value)}>
              {temporades.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <div className="text-sm">
            Club organitzador
            <CampSuggerit
              valor={dades.clubOrganitzador}
              onCanvi={(v) => canvia('clubOrganitzador', v)}
              opcions={clubs}
              placeholder="cap"
              nouText="club nou"
              className={camp}
            />
          </div>
          <label className="text-sm">
            Organitzador (si no és un club)
            <input className={camp} value={dades.organitzador} onChange={(e) => canvia('organitzador', e.target.value)} />
          </label>
          <label className="text-sm">
            Rondes previstes
            <input
              type="number"
              min={1}
              className={camp}
              value={dades.rondesPrevistes ?? ''}
              onChange={(e) => canvia('rondesPrevistes', e.target.value ? Number(e.target.value) : null)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Notes
            <textarea rows={2} className={camp} value={dades.notes} onChange={(e) => canvia('notes', e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dades.finalitzat} onChange={(e) => canvia('finalitzat', e.target.checked)} />
            El campionat s&apos;ha acabat
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dades.computaBarruf} onChange={(e) => canvia('computaBarruf', e.target.checked)} />
            Computa per al BARRUF
          </label>
          {!dades.computaBarruf ? (
            <label className="text-sm sm:col-span-2">
              Per què no computa
              <input className={camp} value={dades.motiuNoComputa} onChange={(e) => canvia('motiuNoComputa', e.target.value)} />
            </label>
          ) : null}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={desa}
            disabled={desant}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-50"
          >
            {desant ? 'Desant…' : 'Desa les dades'}
          </button>
          {missatge ? (
            <span className={`text-sm ${missatge.ok ? 'text-emerald-700' : 'text-red-700'}`}>{missatge.text}</span>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold">Partides</h2>
        <p className="mt-1 text-sm text-stone-600">
          Corregiu la puntuació, o el resultat si no n&apos;hi ha. Amb puntuació, guanya qui en fa més.
        </p>
        <div className="mt-4 space-y-4">
          {perRonda(partides).map(([ronda, llista]) => (
            <div key={ronda}>
              <h3 className="text-sm font-medium text-stone-500">Ronda {ronda}</h3>
              <ul className="mt-1 divide-y divide-stone-100">
                {llista.map((p) => (
                  <FilaPartida key={p.id} campionatId={id} partida={p} onDesada={() => setResultatsTocats(true)} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function FilaPartida({
  campionatId,
  partida,
  onDesada,
}: {
  campionatId: string
  partida: PartidaCampionat
  onDesada: () => void
}) {
  const [punts1, setPunts1] = useState(partida.punts_1?.toString() ?? '')
  const [punts2, setPunts2] = useState(partida.punts_2?.toString() ?? '')
  const [resultat, setResultat] = useState(Number(partida.resultat_1))
  const [estat, setEstat] = useState<string | null>(null)
  const [desant, comença] = useTransition()

  if (partida.numero_2 === null) {
    return (
      <li className="py-1.5 text-sm text-stone-500">
        {partida.jugador_1} descansa
      </li>
    )
  }

  const ambPunts = punts1 !== '' || punts2 !== ''
  const canviada =
    punts1 !== (partida.punts_1?.toString() ?? '') ||
    punts2 !== (partida.punts_2?.toString() ?? '') ||
    resultat !== Number(partida.resultat_1)

  function desa() {
    setEstat(null)
    comença(async () => {
      const r = await desaPartida(
        campionatId,
        partida.id,
        punts1 === '' ? null : Number(punts1),
        punts2 === '' ? null : Number(punts2),
        resultat,
      )
      if (r.ok) {
        setEstat('Desada')
        onDesada()
      } else setEstat(r.error)
    })
  }

  return (
    <li className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 py-1.5 text-sm">
      <span className="text-right">{partida.jugador_1}</span>
      <span className="flex items-center gap-1">
        <input
          inputMode="numeric"
          value={punts1}
          onChange={(e) => setPunts1(e.target.value.replace(/\D/g, ''))}
          className="xifres w-14 rounded border border-stone-300 px-1 py-0.5 text-right"
          placeholder="—"
        />
        –
        <input
          inputMode="numeric"
          value={punts2}
          onChange={(e) => setPunts2(e.target.value.replace(/\D/g, ''))}
          className="xifres w-14 rounded border border-stone-300 px-1 py-0.5"
          placeholder="—"
        />
        {!ambPunts ? (
          <select
            value={resultat}
            onChange={(e) => setResultat(Number(e.target.value))}
            className="ml-1 rounded border border-stone-300 px-1 py-0.5"
            title="Resultat del jugador de l'esquerra"
          >
            <option value={1}>1 – 0</option>
            <option value={0.5}>½ – ½</option>
            <option value={0}>0 – 1</option>
          </select>
        ) : null}
      </span>
      <span>{partida.jugador_2}</span>
      <span className="flex items-center gap-2">
        {canviada ? (
          <button
            type="button"
            onClick={desa}
            disabled={desant}
            className="rounded bg-stone-900 px-2 py-0.5 text-xs text-white disabled:opacity-50"
          >
            {desant ? '…' : 'Desa'}
          </button>
        ) : null}
        {estat ? <span className={`text-xs ${estat === 'Desada' ? 'text-emerald-700' : 'text-red-700'}`}>{estat}</span> : null}
      </span>
    </li>
  )
}
