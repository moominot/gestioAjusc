import Link from 'next/link'

import { Avis } from '../../components/Avis'
import { clientServidor } from '../../lib/supabase/servidor'
import { ETIQUETA_ESTAT, type FilaClassificacio } from '../../lib/supabase/tipus'
import { TaulaBarruf } from './TaulaBarruf'

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
    .order('nom_complet')

  if (error) {
    return <Avis titol="No s&apos;ha pogut carregar la classificació">{error.message}</Avis>
  }

  const files = (data ?? []) as FilaClassificacio[]
  const edicio = files[0]?.edicio

  // El campionat que va entrar en aquesta edició, per enllaçar-hi; i els que
  // hi passen a inactius: només els actius tenen posició, així que són els
  // inactius que a l'edició anterior en tenien.
  const [{ data: computats }, { data: nousInactius }] = edicio
    ? await Promise.all([
        supabase.from('campionats_publics').select('id, nom').eq('primera_edicio', edicio),
        supabase
          .from('barruf_classificacio')
          .select('jugador_numero, nom_complet')
          .eq('estat', 'inact')
          .not('posicio_anterior', 'is', null)
          .order('barruf', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Classificació BARRUF</h1>
          {edicio ? (
            <p className="mt-1 text-sm text-stone-500">
              Edició {edicio}
              {(computats ?? []).map((c) => (
                <span key={c.id as string}>
                  {' · '}
                  <Link href={`/campionats/${c.id}`} className="underline hover:text-stone-900">
                    {c.nom as string}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </div>
        {edicio ? (
          // Un <a> i no un <Link>: és un fitxer, no una pàgina de l'aplicació.
          <a
            href={`/barruf/pdf?edicio=${edicio}`}
            className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:border-stone-500"
          >
            Descarrega el PDF
          </a>
        ) : null}
        <Link
          href="/barruf/temporada"
          className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:border-stone-500"
        >
          Resum de la temporada
        </Link>
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

      {(nousInactius ?? []).length > 0 && (triat === 'act' || triat === 'inact') ? (
        <p className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
          <span className="font-medium text-stone-900">
            Passen a inactius en aquesta edició ({nousInactius!.length}):
          </span>{' '}
          {nousInactius!.map((j, i) => (
            <span key={j.jugador_numero as number}>
              {i > 0 ? ', ' : ''}
              <Link href={`/jugadors/${j.jugador_numero}`} className="hover:underline">
                {j.nom_complet as string}
              </Link>
            </span>
          ))}
          . No han jugat ni aquesta temporada ni les dues anteriors.
        </p>
      ) : null}

      {files.length === 0 ? (
        <Avis titol={`No hi ha cap jugador en estat «${ETIQUETA_ESTAT[triat as 'act']}»`} />
      ) : (
        <TaulaBarruf files={files} ambPosicio={triat === 'act'} />
      )}
    </div>
  )
}
