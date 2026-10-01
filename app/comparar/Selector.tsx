'use client'

import { useRouter } from 'next/navigation'

import { CercaJugador, type JugadorCercable } from '../../components/CercaJugador'
import { COLORS, MAXIM } from '../../lib/comparativa/colors'

/** Els jugadors triats, com a xips, i el cercador per afegir-ne. Tot va a l'adreça. */
export function Selector({ registre, triats }: { registre: JugadorCercable[]; triats: number[] }) {
  const router = useRouter()
  const nom = new Map(registre.map((j) => [j.numero, j.nom]))
  const ves = (numeros: number[]) =>
    router.push(numeros.length ? `/comparar?j=${numeros.join(',')}` : '/comparar', { scroll: false })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {triats.map((n, i) => (
          <span
            key={n}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
            style={{ borderColor: COLORS[i] }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
            {nom.get(n) ?? `núm. ${n}`}
            <button
              type="button"
              onClick={() => ves(triats.filter((x) => x !== n))}
              className="text-stone-400 hover:text-stone-900"
              aria-label={`Treure ${nom.get(n) ?? n}`}
            >
              ×
            </button>
          </span>
        ))}
        {triats.length < MAXIM ? (
          <CercaJugador
            registre={registre.filter((j) => !triats.includes(j.numero))}
            placeholder={triats.length ? 'Afegeix-ne un altre…' : 'Cerca un jugador…'}
            onTria={(j) => ves([...triats, j.numero])}
          />
        ) : null}
      </div>
      {triats.length < 2 ? (
        <p className="text-sm text-stone-500">Trieu almenys dos jugadors (fins a {MAXIM}).</p>
      ) : null}
    </div>
  )
}
