import Link from 'next/link'
import { notFound } from 'next/navigation'

import type { FitxaCampionat } from '../../../../lib/campionats/fitxa'
import { clientServidor } from '../../../../lib/supabase/servidor'
import { EditorCampionat } from './EditorCampionat'

export const metadata = { title: 'Editar campionat' }

export default async function EditarCampionat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const supabase = await clientServidor()
  const [{ data: fitxa }, { data: fila }, { data: clubs }, { data: temporades }, { data: jugadors }] = await Promise.all([
    supabase.rpc('fitxa_campionat', { p_id: id }),
    supabase
      .from('campionats')
      .select('nom, data, temporada_codi, organitzador, rondes_previstes, notes, computa_barruf, motiu_no_computa, finalitzat, primera_edicio, clubs(nom)')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('clubs').select('nom').order('nom'),
    supabase.from('temporades').select('codi').order('any_inici', { ascending: false }),
    supabase.from('jugadors_publics').select('numero, nom_complet, club_nom').order('nom_complet'),
  ])
  if (!fitxa || !fila) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/campionats/${id}`} className="text-sm text-stone-500 underline hover:text-stone-900">
          ← Fitxa del campionat
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Editar: {fila.nom as string}</h1>
        <p className="mt-2 text-sm text-stone-600">
          Si l’organitzador ha enviat els resultats corregits o amb estadístiques,{' '}
          <Link href={`/gestio/campionats/${id}/reimportar`} className="underline hover:text-stone-900">
            torneu a importar el campionat des del fitxer
          </Link>{' '}
          (SwissPerfect, full de càlcul o CSV).
        </p>
      </div>

      <EditorCampionat
        id={id}
        publicatA={(fila.primera_edicio as number | null) ?? null}
        inicial={{
          nom: fila.nom as string,
          data: fila.data as string,
          temporadaCodi: fila.temporada_codi as string,
          organitzador: (fila.organitzador as string | null) ?? '',
          clubOrganitzador: (fila.clubs as unknown as { nom: string } | null)?.nom ?? '',
          rondesPrevistes: (fila.rondes_previstes as number | null) ?? null,
          notes: (fila.notes as string | null) ?? '',
          computaBarruf: fila.computa_barruf as boolean,
          motiuNoComputa: (fila.motiu_no_computa as string | null) ?? '',
          finalitzat: fila.finalitzat as boolean,
        }}
        partides={(fitxa as FitxaCampionat).partides}
        registre={(jugadors ?? []).map((j) => ({
          numero: j.numero as number,
          nom: j.nom_complet as string,
          club: (j.club_nom as string | null) ?? null,
        }))}
        clubs={(clubs ?? []).map((c) => c.nom as string)}
        temporades={(temporades ?? []).map((t) => t.codi as string)}
      />
    </div>
  )
}
