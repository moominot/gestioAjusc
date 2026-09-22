import Link from 'next/link'

import { clientServidor } from '../../../lib/supabase/servidor'
import { Importador } from './Importador'

export const metadata = { title: 'Importar un campionat' }

export default async function ImportarCampionat() {
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
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Importar un campionat</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          Res no es desa fins que ho confirmeu. Primer es llegeixen els fitxers i es miren els noms
          contra el registre; després reviseu el que hagi quedat dubtós.
        </p>
      </div>

      <Importador temporades={(data ?? []).map((t) => t.codi as string)} />
    </div>
  )
}
