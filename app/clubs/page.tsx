import Link from 'next/link'

import { Avis } from '../../components/Avis'
import { clientServidor } from '../../lib/supabase/servidor'

export const metadata = { title: 'Clubs' }
export const revalidate = 300

interface ResumClub {
  nom: string
  nom_llegenda: string | null
  membres: number
  actius: number
  mitjana_actius: number | null
  millor: { numero: number; nom: string; posicio: number } | null
  organitzats: number
}

export default async function Clubs() {
  const supabase = await clientServidor()
  const { data, error } = await supabase.rpc('resum_clubs')
  if (error) return <Avis titol="No s'han pogut carregar els clubs">{error.message}</Avis>
  const clubs = (data ?? []) as ResumClub[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clubs</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          Els clubs dels jugadors del BARRUF i els que organitzen campionats. Els membres són els
          jugadors que hi consten ara.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2 font-medium">Club</th>
              <th className="px-4 py-2 text-right font-medium">Membres</th>
              <th className="px-4 py-2 text-right font-medium">Actius</th>
              <th className="px-4 py-2 text-right font-medium" title="BARRUF mitjà dels actius">BARRUF mitjà</th>
              <th className="px-4 py-2 font-medium">Millor classificat</th>
              <th className="px-4 py-2 text-right font-medium">Campionats organitzats</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {clubs.map((c) => (
              <tr key={c.nom} className="hover:bg-stone-50">
                <td className="px-4 py-2">
                  <Link href={`/clubs/${encodeURIComponent(c.nom)}`} className="font-medium hover:underline">
                    {c.nom}
                  </Link>
                  {c.nom_llegenda ? <span className="ml-2 text-xs text-stone-400">{c.nom_llegenda}</span> : null}
                </td>
                <td className="xifres px-4 py-2 text-right">{c.membres}</td>
                <td className="xifres px-4 py-2 text-right">{c.actius}</td>
                <td className="xifres px-4 py-2 text-right">{c.mitjana_actius ?? '—'}</td>
                <td className="px-4 py-2">
                  {c.millor ? (
                    <Link href={`/jugadors/${c.millor.numero}`} className="hover:underline">
                      {c.millor.nom} <span className="text-stone-400">({c.millor.posicio}a)</span>
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="xifres px-4 py-2 text-right">{c.organitzats || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
