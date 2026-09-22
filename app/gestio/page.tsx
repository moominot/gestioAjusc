import Link from 'next/link'

import { clientServidor, gestorConnectat } from '../../lib/supabase/servidor'

export const metadata = { title: 'Gestió' }

export default async function Gestio() {
  const gestor = await gestorConnectat()
  const supabase = await clientServidor()

  const [{ count: jugadors }, { count: campionats }, { count: pendents }] = await Promise.all([
    supabase.from('jugadors').select('id', { count: 'exact', head: true }),
    supabase.from('campionats').select('id', { count: 'exact', head: true }),
    supabase
      .from('campionats')
      .select('id', { count: 'exact', head: true })
      .eq('computa_barruf', true)
      .eq('finalitzat', false),
  ])

  async function surt() {
    'use server'
    const supabase = await clientServidor()
    await supabase.auth.signOut()
  }

  const xifres = [
    { etiqueta: 'Jugadors', valor: jugadors ?? 0, enllac: '/barruf' },
    { etiqueta: 'Campionats', valor: campionats ?? 0, enllac: '/campionats' },
    { etiqueta: 'Sense finalitzar', valor: pendents ?? 0, enllac: '/campionats' },
  ]

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestió</h1>
          <p className="mt-1 text-sm text-stone-600">Hola, {gestor?.nom}.</p>
        </div>
        <form action={surt}>
          <button type="submit" className="text-sm text-stone-500 underline hover:text-stone-900">
            Sortir
          </button>
        </form>
      </header>

      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-3">
        {xifres.map((xifra) => (
          <Link key={xifra.etiqueta} href={xifra.enllac} className="bg-white px-4 py-3 hover:bg-stone-50">
            <dt className="text-xs uppercase tracking-wide text-stone-500">{xifra.etiqueta}</dt>
            <dd className="xifres mt-1 text-2xl font-semibold">{xifra.valor}</dd>
          </Link>
        ))}
      </dl>

      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="font-semibold">Importar un campionat</h2>
        <p className="mt-1 text-sm text-stone-600">
          El lector dels fitxers del SwissPerfect i la resolució de noms ja són fets i provats
          (<code className="rounded bg-stone-100 px-1">lib/importacio</code>), i de moment es fan
          anar des de la línia d&apos;ordres:
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-stone-900 px-4 py-3 text-sm text-stone-100">
          npm run simula -- &lt;directori amb .trn, .sco i .ini&gt;
        </pre>
        <p className="mt-3 text-sm text-stone-600">
          Queda per fer la pantalla que hi posi la interfície al davant: pujar els fitxers, validar
          els noms dubtosos i publicar l&apos;edició.
        </p>
      </section>
    </div>
  )
}
