import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Avis } from '../../../../components/Avis'
import { clientServidor } from '../../../../lib/supabase/servidor'
import { analitzaRebuda } from '../../importar/accions'
import { Importador } from '../../importar/Importador'

export const metadata = { title: 'Revisar una importació rebuda' }

export default async function RevisarImportacio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const resultat = await analitzaRebuda(id)
  if (!resultat.ok) return <Avis titol="No es pot revisar aquesta importació">{resultat.error}</Avis>
  const { rebuda, proposta, registre } = resultat

  const supabase = await clientServidor()
  const [{ data: temporades }, { data: clubs }, { data: campionat }, { count }, { data: llavor }] = await Promise.all([
    supabase.from('temporades').select('codi').order('any_inici', { ascending: false }),
    supabase.from('clubs').select('nom').order('nom'),
    rebuda.campionatId
      ? supabase.from('campionats').select('nom, primera_edicio').eq('id', rebuda.campionatId).maybeSingle()
      : Promise.resolve({ data: null }),
    rebuda.campionatId
      ? supabase.from('partides').select('id', { count: 'exact', head: true }).eq('campionat_id', rebuda.campionatId)
      : Promise.resolve({ count: 0 }),
    supabase.from('barruf_edicions').select('numero').eq('es_llavor', true).maybeSingle(),
  ])
  const edicio = (campionat?.primera_edicio as number | null) ?? null

  return (
    <div className="space-y-6">
      <div>
        <Link href="/gestio/importacions" className="text-sm text-stone-500 underline hover:text-stone-900">
          ← Importacions rebudes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Revisar: {rebuda.campionat.nom}</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          Enviat per <strong>{rebuda.connexio}</strong> (identificador {rebuda.idExtern}
          {rebuda.versio > 1 ? `, versió ${rebuda.versio}` : ''}). Res no es desa fins que ho
          confirmeu.
          {rebuda.campionat.finalitzat
            ? ' L’aplicació diu que el torneig ja s’ha acabat; comproveu-ho abans de marcar-lo com a finalitzat.'
            : ' L’aplicació diu que el torneig encara no s’ha acabat.'}
        </p>
        {campionat ? (
          <p className="mt-3 max-w-2xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Una versió anterior ja es va importar a «{campionat.nom as string}». En confirmar, se’n
            substituiran els participants i les {count ?? 0} partides per les d’aquesta versió.
            {edicio !== null ? ` Ja és al BARRUF ${edicio}: els canvis hi entraran quan es publiqui una edició nova.` : ''}
          </p>
        ) : null}
      </div>

      <Importador
        temporades={(temporades ?? []).map((t) => t.codi as string)}
        clubs={(clubs ?? []).map((c) => c.nom as string)}
        inicial={{ rebudaId: rebuda.id, proposta, registre, campionat: rebuda.campionat }}
        reimportacio={
          campionat && rebuda.campionatId
            ? {
                id: rebuda.campionatId,
                nom: campionat.nom as string,
                partides: count ?? 0,
                arxiu: edicio !== null && llavor !== null && edicio <= (llavor.numero as number),
              }
            : undefined
        }
      />
    </div>
  )
}
