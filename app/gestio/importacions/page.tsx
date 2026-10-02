import Link from 'next/link'

import { clientServidor } from '../../../lib/supabase/servidor'
import { marcaRebuda } from '../importar/accions'

export const metadata = { title: 'Importacions rebudes' }

const quan = (text: string | null) =>
  text ? new Date(text).toLocaleString('ca-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—'

const ESTAT: Record<string, { text: string; classe: string }> = {
  pendent: { text: 'Per revisar', classe: 'bg-amber-100 text-amber-900' },
  importada: { text: 'Importada', classe: 'bg-emerald-100 text-emerald-800' },
  descartada: { text: 'Descartada', classe: 'bg-stone-200 text-stone-600' },
}

async function descarta(dades: FormData) {
  'use server'
  await marcaRebuda(String(dades.get('id')), null, 'descartada')
}

export default async function Importacions() {
  const supabase = await clientServidor()
  const { data } = await supabase
    .from('importacions_rebudes')
    .select('id, id_extern, versio, estat, campionat_id, actualitzada_el, revisada_el, dades, connexions(nom)')
    .order('actualitzada_el', { ascending: false })
    .limit(200)
  const files = (data ?? []).sort((a, b) => Number(b.estat === 'pendent') - Number(a.estat === 'pendent'))

  return (
    <div className="space-y-6">
      <div>
        <Link href="/gestio" className="text-sm text-stone-500 underline hover:text-stone-900">
          ← Gestió
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Importacions rebudes</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          Campionats que han enviat altres aplicacions (vegeu{' '}
          <Link href="/gestio/connexions" className="underline">
            Connexions
          </Link>
          ). Es revisen amb l’importador de sempre: els noms que no s’hagin pogut associar al
          registre es decideixen a mà. Si l’aplicació torna a enviar el mateix campionat, la versió
          nova substitueix l’anterior; si ja s’havia importat, es torna a importar sobre el mateix
          campionat.
        </p>
      </div>

      {files.length === 0 ? (
        <p className="rounded-lg border border-stone-200 bg-white p-5 text-sm text-stone-500">
          Encara no n’ha arribat cap.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
          {files.map((f) => {
            const dades = f.dades as {
              campionat?: { nom?: string; data?: string }
              participants?: unknown[]
              partides?: unknown[]
            }
            const estat = ESTAT[f.estat as string]
            return (
              <li key={f.id as string} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {dades.campionat?.nom ?? '(sense nom)'}
                    <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${estat.classe}`}>{estat.text}</span>
                  </p>
                  <p className="text-xs text-stone-500">
                    {(f.connexions as unknown as { nom: string } | null)?.nom} · {f.id_extern as string}
                    {(f.versio as number) > 1 ? ` · versió ${f.versio}` : ''} · {dades.campionat?.data} ·{' '}
                    {dades.participants?.length ?? 0} participants, {dades.partides?.length ?? 0} partides · rebuda el{' '}
                    {quan(f.actualitzada_el as string)}
                  </p>
                </div>
                {f.campionat_id ? (
                  <Link href={`/campionats/${f.campionat_id}`} className="text-stone-500 underline hover:text-stone-900">
                    Campionat
                  </Link>
                ) : null}
                {f.estat === 'pendent' ? (
                  <>
                    <Link
                      href={`/gestio/importacions/${f.id}`}
                      className="rounded-lg bg-stone-900 px-3 py-1.5 text-white hover:bg-stone-700"
                    >
                      Revisa i importa
                    </Link>
                    <form action={descarta}>
                      <input type="hidden" name="id" value={f.id as string} />
                      <button type="submit" className="text-stone-500 underline hover:text-red-700">
                        Descarta
                      </button>
                    </form>
                  </>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
