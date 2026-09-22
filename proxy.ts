import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refresca la sessió a cada petició.
 *
 * Sense això els testimonis caduquen i els components de servidor veurien la
 * sessió com a tancada encara que el navegador cregui que és oberta.
 */
export async function proxy(peticio: NextRequest) {
  let resposta = NextResponse.next({ request: peticio })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  await supabase.auth.getUser()
  return resposta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
