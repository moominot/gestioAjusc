'use client'

import { useState, useTransition } from 'react'

import { creaConnexio } from './accions'

/** Crear una connexió i ensenyar-ne la clau, que després ja no es podrà tornar a veure. */
export function NovaConnexio() {
  const [nom, setNom] = useState('')
  const [clau, setClau] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiada, setCopiada] = useState(false)
  const [creant, comença] = useTransition()

  if (clau) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm">
        <p className="font-medium text-emerald-900">Connexió creada. Aquesta és la clau:</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="break-all rounded bg-white px-2 py-1 font-mono text-xs">{clau}</code>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(clau)
              setCopiada(true)
            }}
            className="rounded border border-emerald-400 px-2 py-1 text-xs hover:bg-white"
          >
            {copiada ? 'Copiada' : 'Copia'}
          </button>
        </div>
        <p className="mt-2 text-emerald-900">
          Copieu-la ara i poseu-la a la configuració de l’aplicació: per seguretat no es desa i no
          es podrà tornar a veure. Si es perd, se’n crea una altra i aquesta es revoca.
        </p>
        <button type="button" onClick={() => setClau(null)} className="mt-3 text-emerald-900 underline">
          Fet
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        comença(async () => {
          const r = await creaConnexio(nom)
          if (r.ok) {
            setClau(r.clau)
            setNom('')
            setCopiada(false)
          } else setError(r.error)
        })
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <label className="block text-sm">
        <span className="font-medium">Nom de l’aplicació</span>
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="p. ex. Aparellaments AJUSC"
          className="mt-1 block w-72 max-w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={creant || !nom.trim()}
        className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-50"
      >
        {creant ? 'Creant…' : 'Crea la connexió'}
      </button>
      {error ? <p className="w-full text-sm text-red-700">{error}</p> : null}
    </form>
  )
}
