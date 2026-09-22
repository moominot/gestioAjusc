import { NextResponse, type NextRequest } from 'next/server'

import { clientServidor } from '../../../lib/supabase/servidor'

/** Recull l'enllaç del correu i obre la sessió. */
export async function GET(peticio: NextRequest) {
  const url = new URL(peticio.url)
  const codi = url.searchParams.get('code')

  if (codi) {
    const supabase = await clientServidor()
    const { error } = await supabase.auth.exchangeCodeForSession(codi)
    if (!error) return NextResponse.redirect(new URL('/gestio', url.origin))
    return NextResponse.redirect(
      new URL(`/entrar?error=${encodeURIComponent(error.message)}`, url.origin),
    )
  }

  return NextResponse.redirect(new URL('/entrar?error=Enllaç+no+vàlid', url.origin))
}
