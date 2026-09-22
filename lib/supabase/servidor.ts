import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Client de Supabase per a components de servidor i accions.
 *
 * Fa servir sempre la clau pública: qui mana sobre què es pot llegir i escriure
 * és l'RLS, no el codi. Aquí no hi ha d'aparèixer mai la clau de servei.
 */
export async function clientServidor() {
  const magatzem = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => magatzem.getAll(),
        setAll: (galetes) => {
          try {
            for (const { name, value, options } of galetes) {
              magatzem.set(name, value, options)
            }
          } catch {
            // Des d'un component de servidor no s'hi poden escriure galetes.
            // El middleware ja refresca la sessió, així que no passa res.
          }
        },
      },
    },
  )
}

/** Perfil del gestor connectat, o `null` si qui mira no ho és. */
export async function gestorConnectat() {
  const supabase = await clientServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.from('perfils').select('id, nom, rol').eq('id', user.id).single()
  return data ?? null
}
