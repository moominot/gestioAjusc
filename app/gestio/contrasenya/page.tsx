import Link from 'next/link'
import { redirect } from 'next/navigation'

import { clientServidor } from '../../../lib/supabase/servidor'

export const metadata = { title: 'Contrasenya' }

/** Llargada mínima. GoTrue en demana 6 per defecte; aquí se n'exigeixen més. */
const MINIM = 8

export default async function Contrasenya({
  searchParams,
}: {
  searchParams: Promise<{ fet?: string; error?: string }>
}) {
  const { fet, error } = await searchParams

  async function canvia(dades: FormData) {
    'use server'
    const nova = String(dades.get('nova') ?? '')
    const repeticio = String(dades.get('repeticio') ?? '')
    const torna = (missatge: string) => redirect(`/gestio/contrasenya?error=${encodeURIComponent(missatge)}`)

    if (nova.length < MINIM) torna(`Ha de tenir almenys ${MINIM} caràcters.`)
    if (nova !== repeticio) torna('Les dues contrasenyes no coincideixen.')

    const supabase = await clientServidor()
    const { error } = await supabase.auth.updateUser({ password: nova })
    if (error) torna(error.message)
    redirect('/gestio/contrasenya?fet=1')
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div>
        <Link href="/gestio" className="text-sm text-stone-500 underline hover:text-stone-900">
          ← Gestió
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Canviar la contrasenya</h1>
        <p className="mt-1 text-sm text-stone-600">
          A partir d&apos;ara entrareu amb aquesta. Almenys {MINIM} caràcters.
        </p>
      </div>

      {fet ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Contrasenya canviada.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>
      ) : null}

      <form action={canvia} className="space-y-3">
        <div>
          <label className="block text-sm font-medium" htmlFor="nova">
            Contrasenya nova
          </label>
          <input
            id="nova"
            name="nova"
            type="password"
            required
            minLength={MINIM}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-stone-900 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="repeticio">
            Repetiu-la
          </label>
          <input
            id="repeticio"
            name="repeticio"
            type="password"
            required
            minLength={MINIM}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-stone-900 focus:outline-none"
          />
        </div>
        <button type="submit" className="w-full rounded-lg bg-stone-900 px-4 py-2 text-white hover:bg-stone-700">
          Desa la contrasenya
        </button>
      </form>
    </div>
  )
}
