import Link from 'next/link'

import { trobaDuplicats, type JugadorDades } from '../../../../lib/jugadors/duplicats'
import { clientServidor } from '../../../../lib/supabase/servidor'
import { Duplicats } from './Duplicats'

export const metadata = { title: 'Jugadors duplicats' }

export default async function PaginaDuplicats() {
  const supabase = await clientServidor()
  const { data, error } = await supabase.rpc('dades_duplicats')
  if (error) throw new Error(error.message)

  const { jugadors, descartades } = data as {
    jugadors: JugadorDades[]
    descartades: [number, number][]
  }
  const parelles = trobaDuplicats(jugadors, descartades)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/gestio/jugadors" className="text-sm text-stone-500 underline hover:text-stone-900">
          ← Jugadors
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Possibles duplicats</h1>
        <p className="mt-1 max-w-3xl text-sm text-stone-600">
          Parelles de fitxes amb noms semblants que no han coincidit mai en cap campionat (si hi
          haguessin jugat tots dos, serien dues persones). Si són la mateixa persona, fusioneu-les:
          partides, historial del BARRUF, àlies i quotes passen a la fitxa que queda, i el número de
          l&apos;altra redirigeix a aquesta. Si no ho són, descarteu la parella i no tornarà a sortir.
        </p>
        <p className="mt-2 max-w-3xl text-sm text-stone-600">
          Les edicions ja publicades no canvien: la fusió entrarà al BARRUF quan{' '}
          <Link href="/gestio/publicar" className="underline">
            publiqueu una edició nova
          </Link>
          .
        </p>
      </div>

      <Duplicats
        parelles={parelles}
        registre={jugadors.map((j) => ({ numero: j.numero, nom: j.nom, club: j.club }))}
      />
    </div>
  )
}
