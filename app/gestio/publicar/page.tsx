import Link from 'next/link'

import { clientServidor } from '../../../lib/supabase/servidor'
import { Publicador } from './Publicador'

export const metadata = { title: 'Publicar el BARRUF' }

export default async function PublicarBarruf() {
  const supabase = await clientServidor()
  const { data } = await supabase
    .from('temporades')
    .select('codi')
    .order('any_inici', { ascending: false })

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
      </div>

      <Publicador temporades={(data ?? []).map((t) => t.codi as string)} />
    </div>
  )
}
