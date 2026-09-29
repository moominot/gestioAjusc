'use client'

import { useMemo, useState } from 'react'

import { normalitzaNom } from '../lib/importacio/noms'

export interface JugadorCercable {
  numero: number
  nom: string
  club: string | null
}

/**
 * Cerca un jugador a tot el registre.
 *
 * Sense accents ni majúscules, i per trossos de paraula en qualsevol ordre:
 * «llull carl» troba Carles Llull. També es pot cercar pel número.
 */
export function filtraJugadors<T extends JugadorCercable>(registre: T[], text: string, maxim = 8): T[] {
  const trossos = normalitzaNom(text).split(' ').filter(Boolean)
  if (trossos.length === 0) return []
  const numero = /^\d+$/.test(text.trim()) ? Number(text.trim()) : null

  const trobats = registre.filter((j) => {
    if (numero !== null && j.numero === numero) return true
    const nom = normalitzaNom(j.nom)
    return trossos.every((t) => nom.includes(t))
  })
  // Primer els que comencen pel que s'ha escrit, i després per ordre alfabètic.
  const primer = trossos[0]
  trobats.sort((a, b) => {
    const pa = normalitzaNom(a.nom).split(' ').some((p) => p.startsWith(primer)) ? 0 : 1
    const pb = normalitzaNom(b.nom).split(' ').some((p) => p.startsWith(primer)) ? 0 : 1
    return pa - pb || a.nom.localeCompare(b.nom, 'ca')
  })
  return trobats.slice(0, maxim)
}

export function CercaJugador({
  registre,
  onTria,
  placeholder = 'Cerca al registre…',
  inicial = '',
}: {
  registre: JugadorCercable[]
  onTria: (jugador: JugadorCercable) => void
  placeholder?: string
  inicial?: string
}) {
  const [text, setText] = useState(inicial)
  const [obert, setObert] = useState(false)
  const resultats = useMemo(() => filtraJugadors(registre, text), [registre, text])

  return (
    <div className="relative">
      <input
        type="search"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value)
          setObert(true)
        }}
        onFocus={() => setObert(true)}
        // Es tanca amb un retard perquè el clic a un resultat arribi abans.
        onBlur={() => setTimeout(() => setObert(false), 150)}
        className="w-64 rounded border border-stone-300 px-2 py-1 text-sm"
      />
      {obert && text.trim() ? (
        <ul className="absolute z-10 mt-1 max-h-72 w-80 overflow-auto rounded border border-stone-200 bg-white shadow-lg">
          {resultats.length === 0 ? (
            <li className="px-3 py-2 text-sm text-stone-500">Cap jugador amb aquest nom</li>
          ) : (
            resultats.map((j) => (
              <li key={j.numero}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onTria(j)
                    setText('')
                    setObert(false)
                  }}
                  className="flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-stone-100"
                >
                  <span>{j.nom}</span>
                  <span className="shrink-0 text-xs text-stone-500">
                    {j.club ? `${j.club} · ` : ''}núm. {j.numero}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
