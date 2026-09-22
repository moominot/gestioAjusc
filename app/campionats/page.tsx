import { Avis } from '../../components/Avis'
import { clientServidor } from '../../lib/supabase/servidor'
import type { CampionatPublic } from '../../lib/supabase/tipus'

export const metadata = { title: 'Campionats' }
export const revalidate = 300

function Etiqueta({ campionat }: { campionat: CampionatPublic }) {
  if (campionat.barrufat) {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
        Barrufat
      </span>
    )
  }
  if (!campionat.computa_barruf) {
    return (
      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">Arxiu</span>
    )
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">En curs</span>
  )
}

export default async function Campionats() {
  const supabase = await clientServidor()
  const { data } = await supabase
    .from('campionats_publics')
    .select('*')
    .returns<CampionatPublic[]>()

  const campionats = data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campionats</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          Un campionat es barrufa quan s&apos;acaba. Els d&apos;arxiu són els anteriors al
          registre: es poden consultar i donen estadístiques, però no mouen cap BARRUF.
        </p>
      </div>

      {campionats.length === 0 ? (
        <Avis titol="Encara no hi ha cap campionat registrat" />
      ) : (
        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
          {campionats.map((campionat) => (
            <li key={campionat.id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-medium">{campionat.nom}</span>
                <Etiqueta campionat={campionat} />
                <span className="flex-1" />
                <span className="text-sm text-stone-500">
                  {new Date(campionat.data).toLocaleDateString('ca-ES')}
                </span>
              </div>
              <p className="mt-1 text-sm text-stone-500">
                {campionat.club_organitzador ?? campionat.organitzador ?? 'Organitzador desconegut'}
                {' · '}
                {campionat.participants} participants · {campionat.partides} partides
                {campionat.rondes_jugades
                  ? ` · ${campionat.rondes_jugades} rondes${
                      campionat.rondes_previstes ? ` de ${campionat.rondes_previstes}` : ''
                    }`
                  : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
