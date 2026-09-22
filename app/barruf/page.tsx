import Link from 'next/link'

import { Avis } from '../../components/Avis'
import { clientServidor } from '../../lib/supabase/servidor'
import { ETIQUETA_ESTAT, type FilaClassificacio } from '../../lib/supabase/tipus'

export const metadata = { title: 'Classificació' }
export const revalidate = 300

const ESTATS = [
  { clau: 'act', text: 'Actius' },
  { clau: 'exp', text: 'Expectativa' },
  { clau: 'inact', text: 'Inactius' },
  { clau: 'nov', text: 'Novells' },
] as const

export default async function Classificacio({
  searchParams,
}: {
  searchParams: Promise<{ estat?: string }>
}) {
  const { estat } = await searchParams
  const triat = ESTATS.some((e) => e.clau === estat) ? estat! : 'act'

  const supabase = await clientServidor()
  const { data, error } = await supabase
    .from('barruf_classificacio')
    .select('*')
    .eq('estat', triat)
    .order('barruf', { ascending: false })

  if (error) {
    return <Avis titol="No s&apos;ha pogut carregar la classificació">{error.message}</Avis>
  }

  const files = (data ?? []) as FilaClassificacio[]
  const edicio = files[0]?.edicio

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Classificació BARRUF</h1>
        {edicio ? <p className="mt-1 text-sm text-stone-500">Edició {edicio}</p> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {ESTATS.map((e) => (
          <Link
            key={e.clau}
            href={`/barruf?estat=${e.clau}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              e.clau === triat
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-300 text-stone-600 hover:border-stone-500'
            }`}
          >
            {e.text}
          </Link>
        ))}
      </div>

      {files.length === 0 ? (
        <Avis titol={`No hi ha cap jugador en estat «${ETIQUETA_ESTAT[triat as 'act']}»`} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Pos</th>
                <th className="px-4 py-3 font-medium">Núm</th>
                <th className="px-4 py-3 font-medium">Jugador</th>
                <th className="px-4 py-3 font-medium">Club</th>
                <th className="px-4 py-3 text-right font-medium">BARRUF</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 text-right font-medium">Partides</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {files.map((fila) => (
                <tr key={fila.jugador_numero} className="hover:bg-stone-50">
                  <td className="xifres px-4 py-2 text-stone-400">{fila.posicio ?? '—'}</td>
                  <td className="xifres px-4 py-2 text-stone-400">{fila.jugador_numero}</td>
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/jugadors/${fila.jugador_numero}`} className="hover:underline">
                      {fila.nom_complet}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-stone-600">{fila.club ?? '—'}</td>
                  <td className="xifres px-4 py-2 text-right font-semibold">
                    {Math.round(Number(fila.barruf))}
                  </td>
                  <td className="px-4 py-2 text-stone-600">{fila.categoria ?? '—'}</td>
                  <td className="xifres px-4 py-2 text-right text-stone-600">
                    {fila.partides_totals}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
