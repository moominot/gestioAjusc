import Link from 'next/link'

import { clientServidor } from '../../../lib/supabase/servidor'
import { Despublicador } from './Despublicador'
import { Publicador } from './Publicador'

export const metadata = { title: 'Publicar el BARRUF' }

export default async function PublicarBarruf() {
  const supabase = await clientServidor()
  const [{ data }, { data: ultima }] = await Promise.all([
    supabase.from('temporades').select('codi').order('any_inici', { ascending: false }),
    supabase
      .from('barruf_edicions')
      .select('numero, data_publicacio, campionats_computats, es_llavor')
      .order('numero', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <Link href="/gestio" className="text-sm text-stone-500 underline hover:text-stone-900">
          ← Gestió
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Publicar el BARRUF</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          Es rejuga la cadena sencera des de la llavor amb tots els campionats barrufats. Res no
          s&apos;actualitza a trossos: es recalcula tot cada vegada, de manera que corregir un
          resultat antic i tornar a publicar refà tota la història posterior.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          <strong>Calcular sense desar</strong> mostra el resultat sense tocar res.{' '}
          <strong>Publicar</strong> crea l&apos;edició nova, desa l&apos;estat de tots els jugadors,
          marca com a computats els campionats acabats nous i refà l&apos;evolució dels campionats de
          la cadena. Les edicions ja publicades no canvien mai.{' '}
          <Link href="/gestio/manual#publicar" className="underline">
            Més detalls al manual
          </Link>
          .
        </p>
      </div>

      <Publicador temporades={(data ?? []).map((t) => t.codi as string)} />

      {ultima && !ultima.es_llavor ? (
        <Despublicador
          ultima={{
            numero: ultima.numero as number,
            data: ultima.data_publicacio as string,
            campionats: (ultima.campionats_computats as string | null) ?? null,
          }}
        />
      ) : null}
    </div>
  )
}
