import Link from 'next/link'

import { canvis, etiqueta, frase, NOM_TAULA, type Accio } from '../../../lib/registre/descripcio'
import { clientServidor } from '../../../lib/supabase/servidor'

export const metadata = { title: 'Registre de canvis' }

const OPERACIO = { INSERT: 'creat', UPDATE: 'modificat', DELETE: 'esborrat' } as const

export default async function Registre({ searchParams }: { searchParams: Promise<{ abans?: string }> }) {
  const { abans } = await searchParams
  const supabase = await clientServidor()
  const { data, error } = await supabase.rpc('registre_recent', {
    p_limit: 50,
    p_abans_de: abans && /^\d+$/.test(abans) ? Number(abans) : null,
  })
  const accions = (data ?? []) as Accio[]

  return (
    <div className="space-y-6">
      <div>
        <Link href="/gestio" className="text-sm text-stone-500 underline hover:text-stone-900">
          ← Gestió
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Registre de canvis</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          Tot el que han canviat els gestors, de més recent a més antic. Cada entrada és una acció
          (desar una partida, importar un campionat, fusionar dos jugadors…), amb totes les files
          que va tocar.
        </p>
      </div>

      {error ? <p className="text-sm text-red-700">{error.message}</p> : null}
      {accions.length === 0 ? <p className="text-sm text-stone-500">Encara no hi ha cap canvi registrat.</p> : null}

      <ul className="space-y-2">
        {accions.map((a) => {
          const mostrades = a.detall.length
          const total = a.resum.reduce((s, r) => s + r.files, 0)
          return (
            <li key={a.transaccio} className="rounded-lg border border-stone-200 bg-white">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                  <span className="xifres text-stone-500">
                    {new Date(a.quan).toLocaleString('ca-ES', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  <span className="font-medium">{a.usuari ?? 'Desconegut'}</span>
                  <span className="text-stone-700">{a.resum.map(frase).join(' · ')}</span>
                </summary>
                <ul className="divide-y divide-stone-100 border-t border-stone-100 text-sm">
                  {a.detall.map((f, i) => {
                    const llista = canvis(f)
                    return (
                      <li key={i} className="px-4 py-2">
                        <span className="text-stone-500">
                          {(NOM_TAULA[f.taula]?.[0] ?? f.taula).replace(/^./, (c) => c.toUpperCase())}{' '}
                          {OPERACIO[f.operacio]}
                        </span>
                        {etiqueta(f) ? <span className="ml-2 font-medium">{etiqueta(f)}</span> : null}
                        {llista.length > 0 ? (
                          <ul className="mt-1 space-y-0.5 text-xs text-stone-600">
                            {llista.map((c) => (
                              <li key={c.camp}>
                                <span className="text-stone-400">{c.camp}:</span>{' '}
                                <span className="line-through decoration-stone-300">{c.abans}</span> →{' '}
                                <span className="font-medium text-stone-800">{c.despres}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    )
                  })}
                  {total > mostrades ? (
                    <li className="px-4 py-2 text-xs text-stone-500">
                      … i {total - mostrades} files més en aquesta mateixa acció.
                    </li>
                  ) : null}
                </ul>
              </details>
            </li>
          )
        })}
      </ul>

      {accions.length === 50 ? (
        <Link
          href={`/gestio/registre?abans=${accions[accions.length - 1].primer}`}
          className="inline-block text-sm underline hover:text-stone-900"
        >
          Més antics →
        </Link>
      ) : null}
    </div>
  )
}
