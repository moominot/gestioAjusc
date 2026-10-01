'use client'

import { useMemo, useState } from 'react'

import { normalitzaNom } from '../lib/importacio/noms'

/**
 * Un camp de text que, a mesura que s'escriu, suggereix valors d'una llista
 * (sense accents ni majúscules, per trossos en qualsevol ordre), però que
 * també accepta un valor nou. Com el cercador de jugadors, per a clubs i
 * altres llistes curtes.
 */
export function CampSuggerit({
  valor,
  onCanvi,
  opcions,
  placeholder,
  nouText = 'nou',
  className = '',
}: {
  valor: string
  onCanvi: (valor: string) => void
  opcions: string[]
  placeholder?: string
  /** Com s'indica que el valor escrit no és a la llista. */
  nouText?: string
  className?: string
}) {
  const [obert, setObert] = useState(false)

  const trobades = useMemo(() => {
    const trossos = normalitzaNom(valor).split(' ').filter(Boolean)
    if (trossos.length === 0) return opcions.slice(0, 10)
    return opcions.filter((o) => trossos.every((t) => normalitzaNom(o).includes(t))).slice(0, 10)
  }, [valor, opcions])

  const existeix = opcions.some((o) => normalitzaNom(o) === normalitzaNom(valor))

  return (
    <div className="relative">
      <input
        value={valor}
        placeholder={placeholder}
        onChange={(e) => {
          onCanvi(e.target.value)
          setObert(true)
        }}
        onFocus={() => setObert(true)}
        // Es tanca amb un retard perquè el clic a una opció arribi abans.
        onBlur={() => setTimeout(() => setObert(false), 150)}
        className={className}
        autoComplete="off"
      />
      {valor.trim() && !existeix ? (
        <span className="mt-1 block text-xs text-amber-700">«{valor.trim()}» no hi és: es crearà ({nouText}).</span>
      ) : null}
      {obert && trobades.length > 0 && !(existeix && trobades.length === 1) ? (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border border-stone-200 bg-white shadow-lg">
          {trobades.map((o) => (
            <li key={o}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onCanvi(o)
                  setObert(false)
                }}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-stone-100"
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
