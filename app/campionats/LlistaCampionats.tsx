'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { normalitzaNom } from '../../lib/importacio/noms'
import type { CampionatPublic } from '../../lib/supabase/tipus'
import { ResumCampionats } from './ResumCampionats'

type Estat = 'tots' | 'barrufat' | 'curs' | 'arxiu'

const estatDe = (c: CampionatPublic): Exclude<Estat, 'tots'> =>
  c.barrufat ? 'barrufat' : !c.computa_barruf ? 'arxiu' : 'curs'

function Etiqueta({ campionat }: { campionat: CampionatPublic }) {
  const estat = estatDe(campionat)
  if (estat === 'barrufat') {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
        {campionat.primera_edicio ? `BARRUF ${campionat.primera_edicio}` : 'Barrufat'}
      </span>
    )
  }
  if (estat === 'arxiu') {
    return <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">Arxiu</span>
  }
  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">En curs</span>
}

export function LlistaCampionats({
  campionats,
  jugadorsPer,
  noms,
}: {
  campionats: CampionatPublic[]
  jugadorsPer?: Record<string, number[]>
  noms?: Record<string, string>
}) {
  const [text, setText] = useState('')
  const [temporada, setTemporada] = useState('totes')
  const [estat, setEstat] = useState<Estat>('tots')

  const temporades = useMemo(
    () => [...new Set(campionats.map((c) => c.temporada_codi))].sort().reverse(),
    [campionats],
  )

  const perTemporada = useMemo(() => {
    const trossos = normalitzaNom(text).split(' ').filter(Boolean)
    const filtrats = campionats.filter((c) => {
      if (temporada !== 'totes' && c.temporada_codi !== temporada) return false
      if (estat !== 'tots' && estatDe(c) !== estat) return false
      const on = normalitzaNom(`${c.nom} ${c.club_organitzador ?? ''} ${c.organitzador ?? ''}`)
      return trossos.every((t) => on.includes(t))
    })
    const grups = new Map<string, CampionatPublic[]>()
    for (const c of filtrats) grups.set(c.temporada_codi, [...(grups.get(c.temporada_codi) ?? []), c])
    return [...grups].sort((a, b) => b[0].localeCompare(a[0]))
  }, [campionats, text, temporada, estat])

  const total = perTemporada.reduce((s, [, cs]) => s + cs.length, 0)
  // Amb una cerca o un filtre posat, es despleguen totes les temporades que hi surten.
  const filtrant = text.trim() !== '' || temporada !== 'totes' || estat !== 'tots'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Cerca per nom o organitzador…"
          className="w-full max-w-xs rounded border border-stone-300 px-3 py-1.5 text-sm"
        />
        <select
          value={temporada}
          onChange={(e) => setTemporada(e.target.value)}
          className="rounded border border-stone-300 px-2 py-1.5 text-sm"
        >
          <option value="totes">Totes les temporades</option>
          {temporades.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={estat}
          onChange={(e) => setEstat(e.target.value as Estat)}
          className="rounded border border-stone-300 px-2 py-1.5 text-sm"
        >
          <option value="tots">Tots</option>
          <option value="barrufat">Barrufats</option>
          <option value="curs">En curs</option>
          <option value="arxiu">Arxiu</option>
        </select>
        <span className="text-sm text-stone-500">
          {total} {total === 1 ? 'campionat' : 'campionats'}
        </span>
      </div>

      {total > 0 ? (
        <ResumCampionats
          campionats={perTemporada.flatMap(([, llista]) => llista)}
          jugadorsPer={jugadorsPer}
          noms={noms}
        />
      ) : null}

      {perTemporada.length === 0 ? (
        <p className="text-sm text-stone-500">Cap campionat coincideix amb la cerca.</p>
      ) : (
        perTemporada.map(([codi, llista], index) => (
          <details key={`${codi}-${filtrant}`} open={filtrant || index === 0} className="group">
            <summary className="mb-2 flex cursor-pointer list-none items-baseline gap-2 text-lg font-semibold">
              <span className="inline-block w-4 text-sm text-stone-400 transition-transform group-open:rotate-90">▶</span>
              Temporada {codi}{' '}
              <span className="text-sm font-normal text-stone-400">· {llista.length} campionats</span>
            </summary>
            <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
              {llista.map((c) => (
                <li key={c.id}>
                  <Link href={`/campionats/${c.id}`} className="block px-4 py-3 hover:bg-stone-50">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-medium">{c.nom}</span>
                      <Etiqueta campionat={c} />
                      <span className="flex-1" />
                      <span className="text-sm text-stone-500">
                        {new Date(c.data).toLocaleDateString('ca-ES')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-stone-500">
                      {c.club_organitzador ?? c.organitzador ?? 'Organitzador desconegut'}
                      {' · '}
                      {c.participants} participants · {c.partides} partides
                      {c.rondes_jugades ? ` · ${c.rondes_jugades} rondes` : null}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ))
      )}
    </div>
  )
}
