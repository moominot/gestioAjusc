import { redirect } from 'next/navigation'

import { clientServidor, gestorConnectat } from '../../lib/supabase/servidor'

export const metadata = { title: 'Entrar' }

/**
 * Entrada per enllaç de correu.
 *
 * Sense contrasenyes: els gestors del club són pocs i canvien poc, i un enllaç
 * per correu estalvia haver de gestionar contrasenyes perdudes. Qui no consti a
 * `perfils` pot rebre l'enllaç, però l'RLS no el deixarà veure ni tocar res.
 */
export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ enviat?: string; error?: string }>
}) {
  const { enviat, error } = await searchParams
  if (await gestorConnectat()) redirect('/gestio')

  async function envia(dades: FormData) {
    'use server'
    const correu = String(dades.get('correu') ?? '').trim()
    if (!correu) redirect('/entrar?error=Cal+un+correu')

    const supabase = await clientServidor()
    const { error } = await supabase.auth.signInWithOtp({
      email: correu,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_URL_BASE ?? ''}/auth/retorn`,
      },
    })

    redirect(error ? `/entrar?error=${encodeURIComponent(error.message)}` : '/entrar?enviat=1')
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="mt-1 text-sm text-stone-600">
          Només per als gestors de l&apos;AJUSC. T&apos;enviem un enllaç per correu.
        </p>
      </div>

      {enviat ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Enllaç enviat. Mira el correu.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <form action={envia} className="space-y-3">
        <label className="block text-sm font-medium" htmlFor="correu">
          Adreça electrònica
        </label>
        <input
          id="correu"
          name="correu"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-stone-900 focus:outline-none"
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-stone-900 px-4 py-2 text-white hover:bg-stone-700"
        >
          Envia l&apos;enllaç
        </button>
      </form>
    </div>
  )
}
