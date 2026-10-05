'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { esborraCampionat } from '../accions'

/**
 * Esborrar el campionat sencer, a baix de tot de l'editor. Només si encara no
 * ha entrat a cap edició del BARRUF; cal escriure'n el nom per confirmar-ho.
 */
export function EsborraCampionat({
  id,
  nom,
  publicatA,
  partides,
}: {
  id: string
  nom: string
  publicatA: number | null
  partides: number
}) {
  const router = useRouter()
  const [obert, setObert] = useState(false)
  const [confirmacio, setConfirmacio] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [esborrant, comença] = useTransition()

  if (publicatA !== null) {
    return (
      <section className="rounded-lg border border-stone-200 bg-white p-5 text-sm text-stone-600">
        <h2 className="font-semibold text-stone-900">Esborrar el campionat</h2>
        <p className="mt-1">
          No es pot esborrar: ja és al BARRUF {publicatA}, i les edicions publicades no es toquen. Si
          s’ha d’esborrar, primer cal{' '}
          <Link href="/gestio/publicar" className="underline">
            despublicar
          </Link>{' '}
          l’edició {publicatA} (i les posteriors, si n’hi ha).
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-red-200 bg-red-50/40 p-5 text-sm">
      <h2 className="font-semibold text-red-900">Esborrar el campionat</h2>
      <p className="mt-1 text-stone-700">
        S’esborra el campionat amb {partides === 0 ? 'les inscripcions' : partides === 1 ? 'la seva partida i les inscripcions' : `les seves ${partides} partides i les inscripcions`}. Els jugadors es
        queden al registre. No es pot desfer; el registre de canvis en guarda constància.
      </p>
      {obert ? (
        <div className="mt-3 space-y-2">
          <label className="block">
            Per confirmar-ho, escriviu el nom del campionat: <strong>{nom}</strong>
            <input
              value={confirmacio}
              onChange={(e) => setConfirmacio(e.target.value)}
              autoFocus
              className="mt-1 block w-full max-w-lg rounded border border-red-300 px-2 py-1.5"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={esborrant || confirmacio.trim() !== nom.trim()}
              onClick={() => {
                setError(null)
                comença(async () => {
                  const r = await esborraCampionat(id, confirmacio)
                  if (r.ok) router.push('/campionats')
                  else setError(r.error)
                })
              }}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-white hover:bg-red-800 disabled:opacity-40"
            >
              {esborrant ? 'Esborrant…' : 'Esborra’l definitivament'}
            </button>
            <button
              type="button"
              onClick={() => {
                setObert(false)
                setConfirmacio('')
                setError(null)
              }}
              className="text-stone-600 underline"
            >
              Cancel·la
            </button>
          </div>
          {error ? <p className="text-red-700">{error}</p> : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setObert(true)}
          className="mt-3 rounded border border-red-300 px-3 py-1.5 text-red-800 hover:border-red-500"
        >
          Esborrar el campionat…
        </button>
      )}
    </section>
  )
}
