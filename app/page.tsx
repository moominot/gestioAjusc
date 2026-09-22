import Link from 'next/link'

import { Avis } from '../components/Avis'
import { clientServidor } from '../lib/supabase/servidor'

export const revalidate = 300

export default async function Portada() {
  const supabase = await clientServidor()

  const [{ data: edicio }, { count: actius }, { data: capcalera }] = await Promise.all([
    supabase.from('barruf_ultima_edicio').select('numero, data_publicacio').single(),
    supabase
      .from('barruf_classificacio')
      .select('jugador_numero', { count: 'exact', head: true })
      .eq('estat', 'act'),
    supabase
      .from('barruf_classificacio')
      .select('posicio, jugador_numero, nom_complet, club, barruf, categoria')
      .eq('estat', 'act')
      .order('posicio')
      .limit(5),
  ])

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">
          El rànquing de Scrabble clàssic en català
        </h1>
        <p className="mt-3 max-w-2xl text-stone-600">
          El BARRUF és el barem que manté l&apos;AJUSC amb els resultats dels campionats de
          Scrabble clàssic en català. Cada partida jugada en un campionat barrufat el mou, i el
          càlcul es refà sencer cada vegada, de manera que sempre es pot justificar d&apos;on surt
          cada puntuació.
        </p>
        {edicio ? (
          <p className="mt-3 text-sm text-stone-500">
            Darrera edició publicada: <strong>BARRUF {edicio.numero}</strong> ·{' '}
            {new Date(edicio.data_publicacio).toLocaleDateString('ca-ES')}
            {actius ? ` · ${actius} jugadors actius` : null}
          </p>
        ) : null}
      </section>

      {capcalera && capcalera.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold">Capçalera de la classificació</h2>
          <ol className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {capcalera.map((fila) => (
              <li key={fila.jugador_numero} className="flex items-baseline gap-4 px-4 py-3">
                <span className="xifres w-6 text-right text-sm text-stone-400">{fila.posicio}</span>
                <Link
                  href={`/jugadors/${fila.jugador_numero}`}
                  className="flex-1 font-medium hover:underline"
                >
                  {fila.nom_complet}
                </Link>
                <span className="hidden text-sm text-stone-500 sm:block">{fila.club}</span>
                <span className="xifres w-14 text-right font-semibold">
                  {Math.round(Number(fila.barruf))}
                </span>
              </li>
            ))}
          </ol>
          <Link href="/barruf" className="mt-3 inline-block text-sm underline hover:text-stone-900">
            Veure la classificació sencera
          </Link>
        </section>
      ) : (
        <Avis titol="Encara no hi ha cap edició publicada">
          Quan s&apos;importi el primer campionat, aquí hi sortirà la classificació.
        </Avis>
      )}
    </div>
  )
}
