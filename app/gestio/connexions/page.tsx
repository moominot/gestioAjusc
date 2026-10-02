import Link from 'next/link'

import { clientServidor } from '../../../lib/supabase/servidor'
import { revocaConnexio } from './accions'
import { NovaConnexio } from './NovaConnexio'

export const metadata = { title: 'Connexions' }

const quan = (text: string | null) =>
  text ? new Date(text).toLocaleString('ca-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'mai'

export default async function Connexions() {
  const supabase = await clientServidor()
  const { data } = await supabase
    .from('connexions')
    .select('id, nom, prefix, creat_el, darrer_us, revocada_el')
    .order('creat_el', { ascending: false })
  const connexions = data ?? []

  return (
    <div className="space-y-6">
      <div>
        <Link href="/gestio" className="text-sm text-stone-500 underline hover:text-stone-900">
          ← Gestió
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Connexions</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          Les aplicacions que poden enviar resultats de campionats al BARRUF (per exemple, la que
          gestiona els aparellaments). Cadascuna té la seva clau. El que envien no es desa
          directament: arriba a{' '}
          <Link href="/gestio/importacions" className="underline">
            les importacions rebudes
          </Link>{' '}
          i un gestor ho revisa abans d’importar-ho. Llegir el registre i la classificació no
          necessita cap clau. La documentació de l’API és a <code>docs/api.md</code>.
        </p>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">Connexió nova</h2>
        <NovaConnexio />
      </section>

      <section className="rounded-lg border border-stone-200 bg-white">
        {connexions.length === 0 ? (
          <p className="p-5 text-sm text-stone-500">Encara no hi ha cap connexió.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-xs text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">Aplicació</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">Clau</th>
                <th className="px-4 py-2 font-medium">Darrer ús</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {connexions.map((c) => (
                <tr key={c.id as string} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-2">
                    <span className={c.revocada_el ? 'text-stone-400 line-through' : 'font-medium'}>
                      {c.nom as string}
                    </span>
                    <span className="block text-xs text-stone-500">creada el {quan(c.creat_el as string)}</span>
                  </td>
                  <td className="hidden px-4 py-2 font-mono text-xs text-stone-500 sm:table-cell">
                    {c.prefix as string}…
                  </td>
                  <td className="px-4 py-2 text-stone-600">{quan(c.darrer_us as string | null)}</td>
                  <td className="px-4 py-2 text-right">
                    {c.revocada_el ? (
                      <span className="text-xs text-stone-500">revocada el {quan(c.revocada_el as string)}</span>
                    ) : (
                      <form action={revocaConnexio}>
                        <input type="hidden" name="id" value={c.id as string} />
                        <button type="submit" className="text-xs text-red-700 underline hover:text-red-900">
                          Revoca
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
