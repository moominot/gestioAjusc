'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { normalitzaNom } from '../../lib/importacio/noms'

export interface CampionatTriable {
  id: string
  nom: string
  temporada: string
}

/**
 * Tria un o més campionats, agrupats per temporada. La tria es fa en local i
 * s'aplica en tancar el desplegable (o amb el botó), perquè cada clic no
 * torni a calcular la pàgina.
 */
export function SelectorCampionats({
  campionats,
  temporades,
  triats,
  onAplica,
  className = '',
}: {
  campionats: CampionatTriable[]
  temporades: string[]
  triats: string[]
  onAplica: (ids: string[]) => void
  className?: string
}) {
  const [obert, setObert] = useState(false)
  const [tria, setTria] = useState<Set<string>>(() => new Set(triats))
  const [cerca, setCerca] = useState('')
  const caixa = useRef<HTMLDivElement>(null)

  const canviat = tria.size !== triats.length || triats.some((id) => !tria.has(id))

  const aplica = () => {
    setObert(false)
    if (canviat) onAplica(campionats.filter((c) => tria.has(c.id)).map((c) => c.id))
  }

  // Un clic fora tanca el desplegable i aplica la tria.
  const aplicaRef = useRef(aplica)
  aplicaRef.current = aplica
  useEffect(() => {
    if (!obert) return
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) aplicaRef.current()
    }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aplicaRef.current()
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [obert])

  const grups = useMemo(() => {
    const trossos = normalitzaNom(cerca).split(' ').filter(Boolean)
    const passa = (c: CampionatTriable) => {
      const text = normalitzaNom(`${c.nom} ${c.temporada}`)
      return trossos.every((t) => text.includes(t))
    }
    return [...temporades]
      .reverse()
      .map((t) => ({ t, llista: campionats.filter((c) => c.temporada === t && passa(c)) }))
      .filter((g) => g.llista.length)
  }, [campionats, temporades, cerca])

  const commuta = (ids: string[], marca: boolean) =>
    setTria((ara) => {
      const nou = new Set(ara)
      for (const id of ids) {
        if (marca) nou.add(id)
        else nou.delete(id)
      }
      return nou
    })

  const etiqueta =
    triats.length === 0
      ? 'Tots els campionats'
      : triats.length === 1
        ? (campionats.find((c) => c.id === triats[0])?.nom ?? '1 campionat')
        : `${triats.length} campionats`

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => (obert ? aplica() : setObert(true))}
        aria-expanded={obert}
        className={`${className} flex items-center gap-1 text-left`}
      >
        <span className="truncate">{etiqueta}</span>
        <span className="text-stone-400" aria-hidden>
          ▾
        </span>
      </button>
      {obert ? (
        <div className="absolute left-0 z-20 mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-stone-200 bg-white shadow-lg">
          <div className="border-b border-stone-100 p-2">
            <input
              type="search"
              autoFocus
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              placeholder="Cerca un campionat…"
              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {grups.length === 0 ? <p className="px-1 py-2 text-stone-500">Cap campionat.</p> : null}
            {grups.map((g) => {
              const ids = g.llista.map((c) => c.id)
              const tots = ids.every((id) => tria.has(id))
              return (
                <div key={g.t} className="mb-2 last:mb-0">
                  <label className="flex items-center gap-2 px-1 py-0.5 text-xs font-medium uppercase tracking-wide text-stone-500">
                    <input type="checkbox" checked={tots} onChange={(e) => commuta(ids, e.target.checked)} />
                    {g.t}
                  </label>
                  {g.llista.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 rounded px-1 py-0.5 pl-5 hover:bg-stone-50">
                      <input type="checkbox" checked={tria.has(c.id)} onChange={(e) => commuta([c.id], e.target.checked)} />
                      <span>{c.nom}</span>
                    </label>
                  ))}
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-stone-100 p-2">
            <span className="text-stone-500">
              {tria.size ? `${tria.size} triat${tria.size === 1 ? '' : 's'}` : 'Tots'}
            </span>
            <span className="flex gap-2">
              {tria.size ? (
                <button type="button" onClick={() => setTria(new Set())} className="text-stone-500 underline hover:text-stone-900">
                  Treure’ls
                </button>
              ) : null}
              <button type="button" onClick={aplica} className="rounded bg-stone-900 px-3 py-1 text-white hover:bg-stone-700">
                Aplicar
              </button>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
