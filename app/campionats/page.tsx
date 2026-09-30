import { Avis } from '../../components/Avis'
import { clientServidor } from '../../lib/supabase/servidor'
import type { CampionatPublic } from '../../lib/supabase/tipus'
import { LlistaCampionats } from './LlistaCampionats'

export const metadata = { title: 'Campionats' }
export const revalidate = 300

export default async function Campionats() {
  const supabase = await clientServidor()
  const [{ data }, { data: qui }] = await Promise.all([
    supabase.from('campionats_publics').select('*').returns<CampionatPublic[]>(),
    // Qui ha jugat cada campionat, per comptar jugadors diferents del que es filtri.
    supabase.rpc('jugadors_per_campionat'),
  ])

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
        <LlistaCampionats
          campionats={campionats}
          jugadorsPer={(qui as { campionats: Record<string, number[]> } | null)?.campionats}
          noms={(qui as { noms: Record<string, string> } | null)?.noms}
        />
      )}
    </div>
  )
}
