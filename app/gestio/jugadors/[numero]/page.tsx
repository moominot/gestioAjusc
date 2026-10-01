import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'

import { clientServidor } from '../../../../lib/supabase/servidor'

export const metadata = { title: 'Fitxa del jugador' }

interface FitxaGestio {
  numero: number
  nom_complet: string
  nom: string | null
  cognoms: string | null
  email: string | null
  telefon: string | null
  data_naixement: string | null
  notes: string | null
  club: string | null
  fusionat_a: number | null
  creat_el: string
  modificat_el: string
  alies: { id: string; alies: string; origen: string | null }[]
}

const camp = 'mt-1 w-full rounded-lg border border-stone-300 px-3 py-2'

/** Torna a la fitxa amb un missatge. */
const torna = (numero: number, clau: 'fet' | 'error', text: string) =>
  redirect(`/gestio/jugadors/${numero}?${clau}=${encodeURIComponent(text)}`)

export default async function FitxaJugadorGestio({
  params,
  searchParams,
}: {
  params: Promise<{ numero: string }>
  searchParams: Promise<{ fet?: string; error?: string }>
}) {
  const numero = Number((await params).numero)
  if (!Number.isInteger(numero)) notFound()
  const { fet, error } = await searchParams

  const supabase = await clientServidor()
  const [{ data }, { data: clubs }] = await Promise.all([
    supabase.rpc('fitxa_jugador_gestio', { p_numero: numero }),
    supabase.from('clubs').select('nom').order('nom'),
  ])
  const j = data as FitxaGestio | null
  if (!j) notFound()
  if (j.fusionat_a) redirect(`/gestio/jugadors/${j.fusionat_a}`)

  async function desa(dades: FormData) {
    'use server'
    const valor = (k: string) => String(dades.get(k) ?? '')
    const supabase = await clientServidor()
    const { error } = await supabase.rpc('desa_jugador', {
      p_numero: numero,
      p_dades: {
        nom_complet: valor('nom_complet'),
        nom: valor('nom'),
        cognoms: valor('cognoms'),
        email: valor('email'),
        telefon: valor('telefon'),
        data_naixement: valor('data_naixement'),
        club: valor('club'),
        notes: valor('notes'),
      },
    })
    if (error) torna(numero, 'error', error.message)
    revalidatePath(`/jugadors/${numero}`)
    revalidatePath('/barruf')
    torna(numero, 'fet', 'Desat.')
  }

  async function afegeixAlies(dades: FormData) {
    'use server'
    const supabase = await clientServidor()
    const { error } = await supabase.rpc('afegeix_alies', { p_numero: numero, p_alies: String(dades.get('alies') ?? '') })
    torna(numero, error ? 'error' : 'fet', error ? error.message : 'Àlies afegit.')
  }

  async function treuAlies(dades: FormData) {
    'use server'
    const supabase = await clientServidor()
    const { error } = await supabase.rpc('treu_alies', { p_id: String(dades.get('id')) })
    torna(numero, error ? 'error' : 'fet', error ? error.message : 'Àlies tret.')
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/jugadors/${numero}`} className="text-sm text-stone-500 underline hover:text-stone-900">
          ← Fitxa pública
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {j.nom_complet} <span className="text-base font-normal text-stone-400">núm. {j.numero}</span>
        </h1>
        <p className="mt-1 text-xs text-stone-500">
          Alta: {new Date(j.creat_el).toLocaleDateString('ca-ES')} · Darrer canvi:{' '}
          {new Date(j.modificat_el).toLocaleDateString('ca-ES')}
        </p>
      </div>

      {fet ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{fet}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>
      ) : null}

      <form action={desa} className="space-y-5 rounded-lg border border-stone-200 bg-white p-5">
        <label className="block text-sm">
          <span className="font-medium">Nom al BARRUF</span>
          <span className="ml-2 text-xs text-stone-500">el que surt a les llistes i al PDF</span>
          <input name="nom_complet" defaultValue={j.nom_complet} required className={camp} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Nom</span>
            <input name="nom" defaultValue={j.nom ?? ''} autoComplete="off" className={camp} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Cognoms</span>
            <input name="cognoms" defaultValue={j.cognoms ?? ''} autoComplete="off" className={camp} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Correu</span>
            <input name="email" type="email" defaultValue={j.email ?? ''} autoComplete="off" className={camp} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Telèfon</span>
            <input name="telefon" type="tel" defaultValue={j.telefon ?? ''} autoComplete="off" className={camp} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Data de naixement</span>
            <input name="data_naixement" type="date" defaultValue={j.data_naixement ?? ''} className={camp} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Club</span>
            <input name="club" list="clubs" defaultValue={j.club ?? ''} className={camp} />
            <datalist id="clubs">
              {(clubs ?? []).map((c) => (
                <option key={c.nom as string} value={c.nom as string} />
              ))}
            </datalist>
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium">Notes</span>
          <span className="ml-2 text-xs text-stone-500">internes, no es publiquen</span>
          <textarea name="notes" rows={3} defaultValue={j.notes ?? ''} className={camp} />
        </label>

        <p className="text-xs text-stone-500">
          El correu, el telèfon, la data de naixement i les notes només els veuen els gestors. Si canvieu
          el nom al BARRUF, l’anterior es conserva com a àlies.
        </p>

        <button type="submit" className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700">
          Desa
        </button>
      </form>

      <section className="space-y-3 rounded-lg border border-stone-200 bg-white p-5">
        <div>
          <h2 className="font-semibold">Àlies</h2>
          <p className="mt-1 text-sm text-stone-600">
            Maneres en què s’ha vist escrit el nom als fitxers de resultats. Una importació que porti
            qualsevol d’aquests noms el reconeix sola com a aquest jugador.
          </p>
        </div>
        <ul className="divide-y divide-stone-100 text-sm">
          {j.alies.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 py-1.5">
              <span className="font-medium">{a.alies}</span>
              <span className="text-xs text-stone-400">{a.origen ?? ''}</span>
              <span className="flex-1" />
              <form action={treuAlies}>
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className="text-xs text-stone-500 underline hover:text-red-700">
                  Treure
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={afegeixAlies} className="flex gap-2">
          <input name="alies" required placeholder="Una altra manera d’escriure el nom" className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm" />
          <button type="submit" className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:border-stone-500">
            Afegir
          </button>
        </form>
      </section>
    </div>
  )
}
