import Link from 'next/link'
import { notFound } from 'next/navigation'

import { clientServidor } from '../../../../../lib/supabase/servidor'
import { Importador } from '../../../importar/Importador'

export const metadata = { title: 'Tornar a importar un campionat' }

export default async function ReimportarCampionat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const supabase = await clientServidor()
  const [{ data: campionat }, { count }, { data: llavor }] = await Promise.all([
    supabase.from('campionats').select('nom, primera_edicio').eq('id', id).maybeSingle(),
    supabase.from('partides').select('id', { count: 'exact', head: true }).eq('campionat_id', id),
    supabase.from('barruf_edicions').select('numero').eq('es_llavor', true).maybeSingle(),
  ])
  if (!campionat) notFound()

  const edicio = campionat.primera_edicio as number | null
  const arxiu = edicio !== null && llavor !== null && edicio <= (llavor.numero as number)

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/gestio/campionats/${id}`}
          className="text-sm text-stone-500 underline hover:text-stone-900"
        >
          ← Editar el campionat
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Tornar a importar: {campionat.nom as string}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          Els participants i les {count ?? 0} partides que hi ha ara se substitueixen pels del
          fitxer: resultats, puntuacions i, si n’hi ha, scrabbles i millors jugades. El nom, la
          data i la resta de dades del campionat es conserven. Res no es desa fins que ho
          confirmeu.
        </p>
        {arxiu ? (
          <p className="mt-3 max-w-2xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            És un campionat de l’arxiu (BARRUF {edicio}): les partides es poden completar per a les
            estadístiques, però el BARRUF publicat no se’n recalcula.
          </p>
        ) : edicio !== null ? (
          <p className="mt-3 max-w-2xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Ja és al BARRUF {edicio}. Els canvis de resultats hi entraran quan{' '}
            <Link href="/gestio/publicar" className="underline">
              publiqueu una edició nova
            </Link>
            .
          </p>
        ) : null}
      </div>

      <Importador
        temporades={[]}
        reimportacio={{ id, nom: campionat.nom as string, partides: count ?? 0, arxiu }}
      />
    </div>
  )
}
