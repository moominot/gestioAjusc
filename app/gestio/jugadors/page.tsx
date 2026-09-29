import Link from 'next/link'

import { clientServidor } from '../../../lib/supabase/servidor'
import { EditorJugadors, type JugadorEditable } from './EditorJugadors'

export const metadata = { title: 'Jugadors' }

export default async function Jugadors() {
  const supabase = await clientServidor()
  const [{ data: jugadors, error }, { data: clubs }, { data: classificacio }] = await Promise.all([
    supabase
      .from('jugadors')
      .select('numero, nom_complet, clubs(nom)')
      .is('fusionat_a', null)
      .order('nom_complet'),
    supabase.from('clubs').select('nom').order('nom'),
    supabase.from('barruf_classificacio').select('jugador_numero, barruf, estat'),
  ])

  if (error) throw new Error(error.message)

  const barruf = new Map(
    (classificacio ?? []).map((c) => [
      c.jugador_numero as number,
      { barruf: Math.round(Number(c.barruf)), estat: c.estat as string },
    ]),
  )

  const llista: JugadorEditable[] = (jugadors ?? []).map((j) => ({
    numero: j.numero as number,
    nom: j.nom_complet as string,
    club: (j.clubs as unknown as { nom: string } | null)?.nom ?? null,
    barruf: barruf.get(j.numero as number)?.barruf ?? null,
    estat: barruf.get(j.numero as number)?.estat ?? null,
  }))

  return (
    <div className="space-y-6">
      <div>
        <Link href="/gestio" className="text-sm text-stone-500 underline hover:text-stone-900">
          ← Gestió
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Jugadors</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          Cerqueu un jugador per corregir-ne el nom o el club. El nom d&apos;abans es conserva com a
          àlies, de manera que les importacions que encara l&apos;escriguin així el continuaran
          reconeixent. El club és el nom curt que surt a la llista; si no existeix, es crea.
        </p>
      </div>

      <EditorJugadors jugadors={llista} clubs={(clubs ?? []).map((c) => c.nom as string)} />
    </div>
  )
}
