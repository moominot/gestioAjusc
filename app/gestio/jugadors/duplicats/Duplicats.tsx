'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'

import { CercaJugador, type JugadorCercable } from '../../../../components/CercaJugador'
import type { JugadorDades, ParellaCandidata } from '../../../../lib/jugadors/duplicats'
import { descartaDuplicat, fusionaJugadors } from '../accions'

const periode = (j: JugadorDades) =>
  j.primera ? (j.primera === j.darrera ? j.primera : `${j.primera} a ${j.darrera}`) : 'sense campionats'

function Fitxa({ j }: { j: JugadorDades }) {
  return (
    <div className="min-w-0">
      <Link href={`/jugadors/${j.numero}`} target="_blank" className="font-medium hover:underline">
        {j.nom}
      </Link>
      <div className="text-xs text-stone-500">
        núm. {j.numero}
        {j.club ? ` · ${j.club}` : ''} · {j.partides} partides · {periode(j)}
      </div>
    </div>
  )
}

export function Duplicats({
  parelles,
  registre,
}: {
  parelles: ParellaCandidata[]
  registre: JugadorCercable[]
}) {
  const [fetes, setFetes] = useState<Set<string>>(new Set())
  const [missatge, setMissatge] = useState<{ ok: boolean; text: string } | null>(null)
  const [treballant, comença] = useTransition()
  const [manual, setManual] = useState<{ bo: JugadorCercable | null; dup: JugadorCercable | null }>({
    bo: null,
    dup: null,
  })

  const clau = (p: ParellaCandidata) => `${p.a.numero}-${p.b.numero}`

  function fusiona(bo: { numero: number; nom: string }, dup: { numero: number; nom: string }, parella?: string) {
    const avis =
      `«${dup.nom}» (núm. ${dup.numero}) passarà a ser «${bo.nom}» (núm. ${bo.numero}): ` +
      'partides, historial del BARRUF, àlies i quotes. No es pot desfer des d’aquí. Continuar?'
    if (!window.confirm(avis)) return
    setMissatge(null)
    comença(async () => {
      const r = await fusionaJugadors(bo.numero, dup.numero)
      if (!r.ok) setMissatge({ ok: false, text: r.error })
      else {
        setMissatge({ ok: true, text: `Fusionat: «${r.nomDuplicat}» ara és «${r.nom}» (núm. ${r.bo}).` })
        if (parella) setFetes((f) => new Set(f).add(parella))
        setManual({ bo: null, dup: null })
      }
    })
  }

  function descarta(p: ParellaCandidata) {
    setMissatge(null)
    comença(async () => {
      const r = await descartaDuplicat(p.a.numero, p.b.numero)
      if (!r.ok) setMissatge({ ok: false, text: r.error })
      else setFetes((f) => new Set(f).add(clau(p)))
    })
  }

  const pendents = parelles.filter((p) => !fetes.has(clau(p)))

  return (
    <div className="space-y-8">
      {missatge ? (
        <p
          className={`rounded-lg border px-4 py-3 text-sm ${
            missatge.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {missatge.text}
        </p>
      ) : null}

      <section className="rounded-lg border border-stone-200 bg-white">
        <h2 className="border-b border-stone-200 px-5 py-3 font-semibold">
          {pendents.length} parelles per revisar
        </h2>
        {pendents.length === 0 ? (
          <p className="px-5 py-4 text-sm text-stone-500">No en queda cap.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {pendents.map((p) => (
              <li key={clau(p)} className="space-y-3 px-5 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Fitxa j={p.a} />
                  <Fitxa j={p.b} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {p.motius.map((m) => (
                    <span key={m} className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
                      {m}
                    </span>
                  ))}
                  {p.semblanca > 0 && p.semblanca < 1 ? (
                    <span className="text-stone-500">semblança {Math.round(p.semblanca * 100)} %</span>
                  ) : null}
                  {p.periodesSeparats ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-900">un plega i l’altre comença</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <button
                    type="button"
                    disabled={treballant}
                    onClick={() => fusiona(p.a, p.b, clau(p))}
                    className="rounded bg-stone-900 px-3 py-1 text-white hover:bg-stone-700 disabled:opacity-50"
                  >
                    Fusionar: queda {p.a.nom}
                  </button>
                  <button
                    type="button"
                    disabled={treballant}
                    onClick={() => fusiona(p.b, p.a, clau(p))}
                    className="rounded border border-stone-300 px-3 py-1 hover:border-stone-500 disabled:opacity-50"
                  >
                    Fusionar: queda {p.b.nom}
                  </button>
                  <button
                    type="button"
                    disabled={treballant}
                    onClick={() => descarta(p)}
                    className="rounded px-3 py-1 text-stone-500 underline hover:text-stone-900 disabled:opacity-50"
                  >
                    No són la mateixa persona
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
        <div>
          <h2 className="font-semibold">Fusionar a mà</h2>
          <p className="mt-1 text-sm text-stone-600">
            Per als casos que el filtre no troba, com un canvi de cognom o un sobrenom.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['bo', 'dup'] as const).map((quin) => (
            <div key={quin} className="space-y-2 text-sm">
              <div className="font-medium">{quin === 'bo' ? 'La fitxa que queda' : 'La fitxa que desapareix'}</div>
              {manual[quin] ? (
                <div className="flex items-center gap-2">
                  <span>
                    {manual[quin]!.nom} <span className="text-stone-500">(núm. {manual[quin]!.numero})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setManual({ ...manual, [quin]: null })}
                    className="text-xs text-stone-500 underline"
                  >
                    canviar
                  </button>
                </div>
              ) : (
                <CercaJugador registre={registre} onTria={(j) => setManual({ ...manual, [quin]: j })} />
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={treballant || !manual.bo || !manual.dup || manual.bo.numero === manual.dup.numero}
          onClick={() => manual.bo && manual.dup && fusiona(manual.bo, manual.dup)}
          className="rounded bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {treballant ? 'Fusionant…' : 'Fusionar'}
        </button>
      </section>
    </div>
  )
}
