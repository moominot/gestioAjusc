import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { configuracioSupabase } from './lib/supabase/configuracio'

/**
 * Refresca la sessió a cada petició.
 *
 * Sense això els testimonis caduquen i els components de servidor veurien la
 * sessió com a tancada encara que el navegador cregui que és oberta.
 */
export async function proxy(peticio: NextRequest) {
  let resposta = NextResponse.next({ request: peticio })

  // Sense configuració no funciona res. Val més dir quina variable falta que
  // deixar que tota la web respongui un «Internal Server Error» mut. El
  // missatge només anomena variables, mai en mostra el valor.
  let configuracio: ReturnType<typeof configuracioSupabase>
  try {
    configuracio = configuracioSupabase()
  } catch (error) {
    console.error(error)
    return new NextResponse(`La web no està ben configurada.\n\n${(error as Error).message}\n`, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }
  const { url, clau } = configuracio

  const supabase = createServerClient(
    url,
    clau,
    {
      cookies: {
        getAll: () => peticio.cookies.getAll(),
        setAll: (galetes) => {
          for (const { name, value } of galetes) peticio.cookies.set(name, value)
          resposta = NextResponse.next({ request: peticio })
          for (const { name, value, options } of galetes) {
            resposta.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // Si Supabase no respon, la pàgina encara es pot servir com a visitant.
  try {
    await supabase.auth.getUser()
  } catch (error) {
    console.error('No s’ha pogut refrescar la sessió:', error)
  }
  return resposta
}

export const config = {
  // L'API no fa servir la sessió: no cal refrescar-la a cada crida.
  matcher: ['/((?!api/v1|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
