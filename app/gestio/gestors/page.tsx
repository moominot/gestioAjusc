import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { clientServidor, gestorConnectat } from '../../../lib/supabase/servidor'

export const metadata = { title: 'Gestors' }

interface Gestor {
  id: string
  nom: string
  rol: string
  correu: string
  creat_el: string
  darrera_entrada: string | null
}

const data = (text: string | null) =>
  text ? new Date(text).toLocaleString('ca-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'mai'

export default async function Gestors({
  searchParams,
}: {
  searchParams: Promise<{ fet?: string; error?: string }>
}) {
  const { fet, error } = await searchParams
  const jo = await gestorConnectat()
  const supabase = await clientServidor()
  const { data: llista } = await supabase.rpc('llista_gestors')
  const gestors = (llista ?? []) as Gestor[]

  async function afegeix(dades: FormData) {
    'use server'
    const nom = String(dades.get('nom') ?? '').trim()
    const correu = String(dades.get('correu') ?? '').trim()
    const contrasenya = String(dades.get('contrasenya') ?? '')
    const supabase = await clientServidor()
    const { error } = await supabase.rpc('crea_gestor', { p_nom: nom, p_correu: correu, p_contrasenya: contrasenya })
    if (error) redirect(`/gestio/gestors?error=${encodeURIComponent(error.message)}`)
    revalidatePath('/gestio/gestors')
    redirect(`/gestio/gestors?fet=${encodeURIComponent(`${nom} ja és gestor. Passeu-li el correu i la contrasenya.`)}`)
  }

  async function treu(dades: FormData) {
    'use server'
    const supabase = await clientServidor()
    const { error } = await supabase.rpc('treu_gestor', { p_id: String(dades.get('id')) })
    if (error) redirect(`/gestio/gestors?error=${encodeURIComponent(error.message)}`)
    revalidatePath('/gestio/gestors')
    redirect('/gestio/gestors?fet=Gestor+tret.')
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/gestio" className="text-sm text-stone-500 underline hover:text-stone-900">
          ← Gestió
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Gestors</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          Qui pot importar, editar i publicar. Cada canvi que fan queda al{' '}
          <Link href="/gestio/registre" className="underline">
            registre de canvis
          </Link>{' '}
          amb el seu nom.
        </p>
      </div>

      {fet ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{fet}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>
      ) : null}

      <section className="rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2 font-medium">Nom</th>
              <th className="px-4 py-2 font-medium">Correu</th>
              <th className="px-4 py-2 font-medium">Darrera entrada</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {gestors.map((g) => (
              <tr key={g.id}>
                <td className="px-4 py-2 font-medium">
                  {g.nom}
                  {g.rol === 'admin' ? <span className="ml-2 text-xs text-stone-400">admin</span> : null}
                </td>
                <td className="px-4 py-2 text-stone-600">{g.correu}</td>
                <td className="px-4 py-2 text-stone-500">{data(g.darrera_entrada)}</td>
                <td className="px-4 py-2 text-right">
                  {g.id === jo?.id ? (
                    <span className="text-xs text-stone-400">vós</span>
                  ) : (
                    <form action={treu}>
                      <input type="hidden" name="id" value={g.id} />
                      <button type="submit" className="text-xs text-stone-500 underline hover:text-red-700">
                        Treure
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="max-w-md space-y-3 rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold">Afegir un gestor</h2>
        <p className="text-sm text-stone-600">
          Poseu-li una contrasenya inicial i passeu-la-hi: la podrà canviar a Gestió → Contrasenya.
          Si el correu ja tenia compte, se li posa aquesta contrasenya.
        </p>
        <form action={afegeix} className="space-y-3">
          {[
            ['nom', 'Nom', 'text', 'name'],
            ['correu', 'Adreça electrònica', 'email', 'off'],
            ['contrasenya', 'Contrasenya inicial (almenys 8 caràcters)', 'text', 'off'],
          ].map(([nom, etiqueta, tipus, auto]) => (
            <label key={nom} className="block text-sm">
              <span className="font-medium">{etiqueta}</span>
              <input
                name={nom}
                type={tipus}
                required
                minLength={nom === 'contrasenya' ? 8 : undefined}
                autoComplete={auto}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              />
            </label>
          ))}
          <button type="submit" className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700">
            Afegir
          </button>
        </form>
      </section>
    </div>
  )
}
