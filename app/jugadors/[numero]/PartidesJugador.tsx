'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { filtra, perRival, resumeix, type FiltrePartides } from '../../../lib/jugadors/partides'
import type { FilaEnfrontament } from '../../../lib/supabase/tipus'

const PER_PAGINA = 50

const decimal = (valor: number) =>
  valor.toLocaleString('ca-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function PartidesJugador({ partides }: { partides: FilaEnfrontament[] }) {
  const [filtre, setFiltre] = useState<FiltrePartides>({ rival: null, temporada: null, campionat: null })
  const [mostrades, setMostrades] = useState(PER_PAGINA)

  const temporades = useMemo(() => [...new Set(partides.map((p) => p.temporada_codi))].sort().reverse(), [partides])
  // Els campionats de la temporada triada (o tots), del més recent al més antic.
  const campionats = useMemo(() => {
    const vistos = new Map<string, string>()
    for (const p of partides) {
      if (filtre.temporada === null || p.temporada_codi === filtre.temporada) vistos.set(p.campionat_id, p.campionat)
    }
    return [...vistos]
  }, [partides, filtre.temporada])
  const rivals = useMemo(() => perRival(partides), [partides])

  const filtrades = useMemo(() => filtra(partides, filtre), [partides, filtre])
  const resum = useMemo(() => resumeix(filtrades), [filtrades])
  const rivalsFiltrats = useMemo(() => perRival(filtrades), [filtrades])

  const canvia = (parcial: Partial<FiltrePartides>) => {
    setFiltre((f) => {
      const nou = { ...f, ...parcial }
      // Si canvia la temporada, el campionat triat potser ja no hi és.
      if (parcial.temporada !== undefined && parcial.campionat === undefined) nou.campionat = null
      return nou
    })
    setMostrades(PER_PAGINA)
  }
  const hiHaFiltre = filtre.rival !== null || filtre.temporada !== null || filtre.campionat !== null

  const xifres = [
    { etiqueta: 'Partides', valor: String(resum.partides) },
    { etiqueta: 'V – E – D', valor: `${resum.victories} – ${resum.empats} – ${resum.derrotes}` },
    { etiqueta: '% victòries', valor: resum.percentatge === null ? '—' : `${Math.round(resum.percentatge * 100)} %` },
    {
      etiqueta: 'Punts per partida',
      valor:
        resum.mitjanaFavor === null
          ? '—'
          : `${Math.round(resum.mitjanaFavor)} – ${Math.round(resum.mitjanaContra!)}`,
    },
  ]

  if (partides.length === 0) {
    return <p className="mt-3 text-sm text-stone-500">Encara no hi ha cap partida registrada.</p>
  }

  return (
    <div className="mt-3 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filtre.rival ?? ''}
          onChange={(e) => canvia({ rival: e.target.value ? Number(e.target.value) : null })}
          className="max-w-xs rounded border border-stone-300 px-2 py-1.5 text-sm"
        >
          <option value="">Contra tothom</option>
          {rivals.map((r) => (
            <option key={r.numero} value={r.numero}>
              {r.nom} ({r.partides})
            </option>
          ))}
        </select>
        <select
          value={filtre.temporada ?? ''}
          onChange={(e) => canvia({ temporada: e.target.value || null })}
          className="rounded border border-stone-300 px-2 py-1.5 text-sm"
        >
          <option value="">Totes les temporades</option>
          {temporades.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={filtre.campionat ?? ''}
          onChange={(e) => canvia({ campionat: e.target.value || null })}
          className="max-w-xs rounded border border-stone-300 px-2 py-1.5 text-sm"
        >
          <option value="">Tots els campionats</option>
          {campionats.map(([id, nom]) => (
            <option key={id} value={id}>
              {nom}
            </option>
          ))}
        </select>
        {hiHaFiltre ? (
          <button
            type="button"
            onClick={() => canvia({ rival: null, temporada: null, campionat: null })}
            className="text-sm text-stone-500 underline hover:text-stone-900"
          >
            Treu els filtres
          </button>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-4">
        {xifres.map((x) => (
          <div key={x.etiqueta} className="bg-white px-4 py-3">
            <dt className="text-xs uppercase tracking-wide text-stone-500">{x.etiqueta}</dt>
            <dd className="xifres mt-1 text-lg font-semibold">{x.valor}</dd>
          </div>
        ))}
      </dl>

      {resum.millor || resum.victoriaMesAmplia ? (
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {resum.millor ? (
            <li className="rounded-lg border border-stone-200 bg-white px-4 py-2">
              <span className="text-stone-500">Millor puntuació:</span> <strong>{resum.millor.punts}</strong> contra{' '}
              {resum.millor.rival} ({resum.millor.campionat})
            </li>
          ) : null}
          {resum.victoriaMesAmplia ? (
            <li className="rounded-lg border border-stone-200 bg-white px-4 py-2">
              <span className="text-stone-500">Victòria més àmplia:</span> {resum.victoriaMesAmplia.punts}–
              {resum.victoriaMesAmplia.punts_rival} contra {resum.victoriaMesAmplia.rival}
            </li>
          ) : null}
        </ul>
      ) : null}

      {filtre.rival === null && rivalsFiltrats.length > 1 ? (
        <details className="rounded-lg border border-stone-200 bg-white">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
            Balanç per rival <span className="font-normal text-stone-400">· {rivalsFiltrats.length} rivals</span>
          </summary>
          <table className="min-w-full border-t border-stone-100 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">Rival</th>
                <th className="px-4 py-2 text-right font-medium">Partides</th>
                <th className="px-4 py-2 text-right font-medium">Victòries</th>
                <th className="px-4 py-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rivalsFiltrats.map((r) => (
                <tr key={r.numero} className="hover:bg-stone-50">
                  <td className="px-4 py-1.5">
                    <button type="button" onClick={() => canvia({ rival: r.numero })} className="hover:underline">
                      {r.nom}
                    </button>
                  </td>
                  <td className="xifres px-4 py-1.5 text-right">{r.partides}</td>
                  <td className="xifres px-4 py-1.5 text-right">{decimal(r.victories)}</td>
                  <td
                    className={`xifres px-4 py-1.5 text-right ${r.percentatge >= 0.5 ? 'text-emerald-700' : 'text-red-700'}`}
                  >
                    {Math.round(r.percentatge * 100)} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}

      {filtrades.length === 0 ? (
        <p className="text-sm text-stone-500">Cap partida amb aquests filtres.</p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
          {filtrades.slice(0, mostrades).map((partida, index) => {
            const resultat = Number(partida.resultat)
            return (
              <li
                key={`${partida.campionat_id}-${partida.ronda}-${partida.rival_numero}-${index}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2 text-sm"
              >
                <span
                  className={`w-6 font-semibold ${
                    resultat === 1 ? 'text-emerald-700' : resultat === 0 ? 'text-red-700' : 'text-stone-500'
                  }`}
                >
                  {resultat === 1 ? 'V' : resultat === 0 ? 'D' : 'E'}
                </span>
                <Link href={`/jugadors/${partida.rival_numero}`} className="flex-1 hover:underline">
                  {partida.rival}
                </Link>
                {partida.punts !== null ? (
                  <span className="xifres text-stone-600">
                    {partida.punts}–{partida.punts_rival}
                  </span>
                ) : null}
                <Link href={`/campionats/${partida.campionat_id}`} className="text-stone-400 hover:underline">
                  {partida.campionat} · r{partida.ronda}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {filtrades.length > mostrades ? (
        <button
          type="button"
          onClick={() => setMostrades((m) => m + PER_PAGINA)}
          className="text-sm text-stone-600 underline hover:text-stone-900"
        >
          Mostra&apos;n més ({filtrades.length - mostrades} més)
        </button>
      ) : null}
    </div>
  )
}
