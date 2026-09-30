'use client'

import Link from 'next/link'
import { useMemo } from 'react'

import { resumeix, type CampionatResum, type Destacat } from '../../lib/campionats/resum'

const enter = (n: number) => n.toLocaleString('ca-ES')
const decimal = (n: number) => n.toLocaleString('ca-ES', { maximumFractionDigits: 1 })

function Linia({ etiqueta, d, unitat }: { etiqueta: string; d: Destacat | null; unitat: string }) {
  if (!d) return null
  const nom = d.id ? (
    <Link href={`/campionats/${d.id}`} className="font-medium hover:underline">
      {d.nom}
    </Link>
  ) : d.numero ? (
    <Link href={`/jugadors/${d.numero}`} className="font-medium hover:underline">
      {d.nom}
    </Link>
  ) : (
    <span className="font-medium">{d.nom}</span>
  )
  return (
    <li className="rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm">
      <span className="text-stone-500">{etiqueta}:</span> {nom}{' '}
      <span className="xifres text-stone-600">
        ({enter(d.valor)} {unitat})
      </span>
    </li>
  )
}

/** Les xifres del que hi ha a la llista, amb els filtres que hi hagi posats. */
export function ResumCampionats({
  campionats,
  jugadorsPer,
  noms,
}: {
  campionats: CampionatResum[]
  jugadorsPer?: Record<string, number[]>
  noms?: Record<string, string>
}) {
  const r = useMemo(() => resumeix(campionats, jugadorsPer, noms), [campionats, jugadorsPer, noms])

  const tesseles = [
    { etiqueta: 'Campionats', valor: enter(r.campionats) },
    { etiqueta: 'Partides', valor: enter(r.partides) },
    ...(r.jugadors !== null ? [{ etiqueta: 'Jugadors diferents', valor: enter(r.jugadors) }] : []),
    { etiqueta: 'Participacions', valor: enter(r.participacions) },
    { etiqueta: 'Jugadors per campionat', valor: decimal(r.mitjanaJugadors) },
    { etiqueta: 'Partides per campionat', valor: decimal(r.mitjanaPartides) },
  ]

  return (
    <section className="space-y-3">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-3 lg:grid-cols-6">
        {tesseles.map((t) => (
          <div key={t.etiqueta} className="bg-white px-4 py-3">
            <dt className="text-xs uppercase tracking-wide text-stone-500">{t.etiqueta}</dt>
            <dd className="xifres mt-1 text-2xl font-semibold">{t.valor}</dd>
          </div>
        ))}
      </dl>
      <ul className="grid gap-2 sm:grid-cols-2">
        <Linia etiqueta="Amb més jugadors" d={r.mesJugadors} unitat="jugadors" />
        <Linia etiqueta="Amb més partides" d={r.mesPartides} unitat="partides" />
        <Linia etiqueta="Amb més rondes" d={r.mesRondes} unitat="rondes" />
        <Linia etiqueta="Qui n’organitza més" d={r.organitzador} unitat="campionats" />
        <Linia etiqueta="Temporada amb més campionats" d={r.temporada} unitat="campionats" />
        <Linia etiqueta="Qui ha jugat més campionats" d={r.jugadorMesCampionats} unitat="campionats" />
      </ul>
    </section>
  )
}
