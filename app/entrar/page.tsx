import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { clientServidor, gestorConnectat } from '../../lib/supabase/servidor'

export const metadata = { title: 'Entrar' }

/**
 * Entrada dels gestors: correu i contrasenya.
 *
 * L'enllaç per correu queda com a alternativa per a qui ha oblidat la
 * contrasenya: un cop dins, la pot canviar a Gestió → Contrasenya. Qui no
 * consti a `perfils` pot tenir compte, però l'RLS no el deixarà veure ni tocar
 * res.
 */

/**
 * On ha de tornar l'enllaç del correu.
 *
 * Si no s'ha fixat NEXT_PUBLIC_URL_BASE, la treu de la mateixa petició: així
 * funciona igual a localhost, al domini de producció i a les previsualitzacions
 * de Vercel sense configurar res. Supabase només hi envia si l'adreça consta a
 * les Redirect URLs, o sigui que no es pot desviar cap a un altre lloc.
 */
async function adrecaBase(): Promise<string> {
  const fixada = process.env.NEXT_PUBLIC_URL_BASE?.trim()
  if (fixada) return fixada.replace(/\/+$/, '')

  const capcaleres = await headers()
  const origen = capcaleres.get('origin')
  if (origen) return origen

  const amfitrio = capcaleres.get('x-forwarded-host') ?? capcaleres.get('host')
  const protocol = capcaleres.get('x-forwarded-proto') ?? 'https'
  return `${protocol}://${amfitrio}`
}

const ambError = (missatge: string) => `/entrar?error=${encodeURIComponent(missatge)}`

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ enviat?: string; error?: string }>
}) {
  const { enviat, error } = await searchParams
  if (await gestorConnectat()) redirect('/gestio')

  async function entra(dades: FormData) {
    'use server'
    const correu = String(dades.get('correu') ?? '').trim()
    const contrasenya = String(dades.get('contrasenya') ?? '')
    if (!correu || !contrasenya) redirect(ambError('Cal el correu i la contrasenya.'))

    const supabase = await clientServidor()
    const { error } = await supabase.auth.signInWithPassword({ email: correu, password: contrasenya })
    // No es diu si el que falla és el correu o la contrasenya.
    if (error) redirect(ambError('El correu o la contrasenya no són correctes.'))
    redirect('/gestio')
  }

  async function enviaEnllac(dades: FormData) {
    'use server'
    const correu = String(dades.get('correu') ?? '').trim()
    if (!correu) redirect(ambError('Cal un correu.'))

    const supabase = await clientServidor()
    const { error } = await supabase.auth.signInWithOtp({
      email: correu,
      options: {
        emailRedirectTo: `${await adrecaBase()}/auth/retorn`,
        // Només per a comptes que ja existeixen: l'enllaç no dona d'alta ningú.
        shouldCreateUser: false,
      },
    })

    redirect(error ? ambError(error.message) : '/entrar?enviat=1')
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="mt-1 text-sm text-stone-600">Només per als gestors de l&apos;AJUSC.</p>
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

      <form action={entra} className="space-y-3">
        <div>
          <label className="block text-sm font-medium" htmlFor="correu">
            Adreça electrònica
          </label>
          <input
            id="correu"
            name="correu"
            type="email"
            required
            autoComplete="username"
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-stone-900 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="contrasenya">
            Contrasenya
          </label>
          <input
            id="contrasenya"
            name="contrasenya"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-stone-900 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-stone-900 px-4 py-2 text-white hover:bg-stone-700"
        >
          Entrar
        </button>
      </form>

      <details className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer text-stone-600">He oblidat la contrasenya</summary>
        <p className="mt-2 text-stone-600">
          T&apos;enviem un enllaç per entrar sense contrasenya. Un cop dins, en pots posar una de
          nova a Gestió → Contrasenya.
        </p>
        <form action={enviaEnllac} className="mt-3 flex gap-2">
          <input
            name="correu"
            type="email"
            required
            placeholder="Adreça electrònica"
            autoComplete="email"
            className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-1.5"
          />
          <button type="submit" className="rounded-lg border border-stone-300 px-3 py-1.5 hover:border-stone-500">
            Envia l&apos;enllaç
          </button>
        </form>
      </details>
    </div>
  )
}
