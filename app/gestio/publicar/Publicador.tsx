'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'

import { previsualitza, publica, type Previsualitzacio } from './accions'

const ETIQUETA_ESTAT: Record<string, string> = {
  nov: 'Novell',
  exp: 'Expectativa',
  act: 'Actiu',
  inact: 'Inactiu',
}

function Moviments({
  titol,
  files,
}: {
  titol: string
  files: Previsualitzacio['majorsPujades']
}) {
  if (files.length === 0) return null
  return (
    <div>
      <h3 className="text-sm font-semibold">{titol}</h3>
      <ul className="mt-2 divide-y divide-stone-100 rounded border border-stone-200">
        {files.map((fila) => (
          <li key={fila.numero} className="flex items-baseline gap-3 px-3 py-1.5 text-sm">
            <Link href={`/jugadors/${fila.numero}`} className="flex-1 hover:underline">
              {fila.nom}
            </Link>
            <span className="xifres text-stone-400">{Math.round(fila.barrufAbans)}</span>
            <span
              className={`xifres w-16 text-right font-medium ${
                fila.variacio >= 0 ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {fila.variacio >= 0 ? '+' : ''}
              {fila.variacio.toFixed(1)}
            </span>
            <span className="xifres w-12 text-right font-semibold">
              {Math.round(fila.barrufDespres)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Publicador({ temporades }: { temporades: string[] }) {
  const [temporada, setTemporada] = useState(temporades[0] ?? '')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [previ, setPrevi] = useState<Previsualitzacio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [publicat, setPublicat] = useState<number | null>(null)
  const [treballant, comença] = useTransition()

  function calcula() {
    setError(null)
    comença(async () => {
      const resultat = await previsualitza(temporada)
      if (resultat.ok) setPrevi(resultat.previsualitzacio)
      else setError(resultat.error)
    })
  }

  function confirma() {
    setError(null)
    comença(async () => {
      const resultat = await publica(temporada, data)
      if (resultat.ok) setPublicat(resultat.numero)
      else setError(resultat.error)
    })
  }

  if (publicat !== null) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="font-semibold text-emerald-900">BARRUF {publicat} publicat</h2>
        <p className="mt-2 text-sm text-emerald-900">
          La classificació pública ja mostra els valors nous.
        </p>
        <Link href="/barruf" className="mt-3 inline-block text-sm underline">
          Veure la classificació
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <section className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Temporada de referència</span>
            <select
              value={temporada}
              onChange={(e) => {
                setTemporada(e.target.value)
                setPrevi(null)
              }}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
            >
              {temporades.map((codi) => (
                <option key={codi} value={codi}>
                  {codi}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-stone-500">
              Decideix qui passa a inactiu: qui fa dues temporades que no juga.
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Data de publicació</span>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={calcula}
          disabled={treballant}
          className="rounded-lg border border-stone-900 px-4 py-2 text-sm hover:bg-stone-100 disabled:opacity-50"
        >
          {treballant && !previ ? 'Calculant…' : 'Calcular sense desar'}
        </button>
      </section>

      {previ ? (
        <>
          <section className="rounded-lg border border-stone-200 bg-white p-5">
            <h2 className="font-semibold">Quedaria així</h2>
            <p className="mt-1 text-sm text-stone-600">
              Es publicaria el <strong>BARRUF {previ.numeroProposat}</strong> rejugant{' '}
              {previ.campionats.length}{' '}
              {previ.campionats.length === 1 ? 'campionat' : 'campionats'} des de la llavor.
            </p>
            <p className="mt-2 text-sm text-stone-600">
              {previ.totalJugadors} jugadors · {previ.actius} actius · {previ.ambVariacio} amb la
              puntuació moguda.
            </p>
            {previ.campionats.length === 0 ? (
              <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No hi ha cap campionat que entri a la cadena. Un campionat hi entra quan computa
                per al BARRUF <em>i</em> està marcat com a finalitzat.
              </p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm text-stone-600">
                {previ.campionats.map((c) => (
                  <li key={c.id}>
                    {c.nom} · {new Date(c.data).toLocaleDateString('ca-ES')}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {previ.ambVariacio > 0 ? (
            <section className="grid gap-6 sm:grid-cols-2">
              <Moviments titol="Qui puja més" files={previ.majorsPujades} />
              <Moviments titol="Qui baixa més" files={previ.majorsBaixades} />
            </section>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={confirma}
              disabled={treballant || previ.campionats.length === 0}
              className="rounded-lg bg-stone-900 px-4 py-2 text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {treballant ? 'Publicant…' : `Publicar el BARRUF ${previ.numeroProposat}`}
            </button>
            <p className="text-sm text-stone-500">
              Les edicions publicades no es toquen mai: si després cal corregir res, es publica
              una edició nova.
            </p>
          </div>
        </>
      ) : null}
    </div>
  )
}
