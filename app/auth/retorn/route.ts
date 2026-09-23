import { NextResponse, type NextRequest } from 'next/server'

import { clientServidor } from '../../../lib/supabase/servidor'

/**
 * Redirecció relativa: el navegador es queda al domini on ja és.
 *
 * No es construeix amb l'origen de `peticio.url` perquè darrere d'un proxy (un
 * contenidor, un túnel) aquest origen és l'intern, `http://localhost:3000`, i
 * l'enllaç del correu acabaria enviant el gestor a un lloc que no existeix.
 */
function cap(desti: string) {
  return new NextResponse(null, { status: 307, headers: { Location: desti } })
}

/** Recull l'enllaç del correu i obre la sessió. */
export async function GET(peticio: NextRequest) {
  const codi = new URL(peticio.url).searchParams.get('code')

  if (codi) {
    const supabase = await clientServidor()
    const { error } = await supabase.auth.exchangeCodeForSession(codi)
    if (!error) return cap('/gestio')
    return cap(`/entrar?error=${encodeURIComponent(error.message)}`)
  }

  return cap(`/entrar?error=${encodeURIComponent('Enllaç no vàlid')}`)
}
