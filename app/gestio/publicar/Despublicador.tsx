'use client'

import { useState, useTransition } from 'react'

import { despublica } from './accions'

export interface UltimaEdicio {
  numero: number
  data: string
  campionats: string | null
}

/**
 * Desfer l'última edició. Cal escriure'n el número per confirmar-ho: és una
 * acció que no es fa cada dia i que no s'ha de poder fer d'un clic distret.
 */
export function Despublicador({ ultima }: { ultima: UltimaEdicio }) {
  const [obert, setObert] = useState(false)
  const [confirmacio, setConfirmacio] = useState('')
  const [missatge, setMissatge] = useState<{ ok: boolean; text: string } | null>(null)
  const [treballant, comença] = useTransition()

  function fes() {
    comença(async () => {
      const r = await despublica(ultima.numero)
      setMissatge(
        r.ok
          ? {
              ok: true,
              text: `S'ha despublicat el BARRUF ${r.numero}.${r.noms ? ` Tornen a quedar pendents: ${r.noms}.` : ''} Corregiu el que calgui i torneu a publicar.`,
            }
          : { ok: false, text: r.error },
      )
      if (r.ok) setObert(false)
    })
  }

  return (
    <section className="space-y-3 rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="font-semibold">Despublicar l’última edició</h2>
      {missatge ? (
        <p
          className={`rounded border px-3 py-2 text-sm ${
            missatge.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {missatge.text}
        </p>
      ) : null}
      <p className="text-sm text-stone-600">
        L’última publicada és el <strong>BARRUF {ultima.numero}</strong> (
        {new Date(ultima.data).toLocaleDateString('ca-ES')}
        {ultima.campionats ? `, amb ${ultima.campionats}` : ''}). Si s’hi ha detectat un error gros,
        es pot desfer: l’edició s’esborra, la classificació torna a l’anterior i els campionats que
        hi havien entrat tornen a quedar pendents. Llavors es corregeix i es torna a publicar amb el
        mateix número. Si el PDF ja ha circulat, val més publicar-ne una de nova amb la correcció.
      </p>
      {obert ? (
        <div className="space-y-2 rounded border border-red-200 bg-red-50 p-3 text-sm">
          <label className="block">
            Per confirmar-ho, escriviu el número de l’edició ({ultima.numero}):
            <input
              value={confirmacio}
              onChange={(e) => setConfirmacio(e.target.value)}
              inputMode="numeric"
              className="mt-1 block w-32 rounded border border-stone-300 px-2 py-1"
            />
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={fes}
              disabled={treballant || confirmacio.trim() !== String(ultima.numero)}
              className="rounded bg-red-700 px-3 py-1.5 text-white hover:bg-red-800 disabled:opacity-50"
            >
              {treballant ? 'Despublicant…' : `Despublicar el BARRUF ${ultima.numero}`}
            </button>
            <button type="button" onClick={() => setObert(false)} className="text-stone-600 underline">
              Cancel·lar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setObert(true)
            setConfirmacio('')
            setMissatge(null)
          }}
          className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-800 hover:border-red-500"
        >
          Despublicar el BARRUF {ultima.numero}…
        </button>
      )}
    </section>
  )
}
