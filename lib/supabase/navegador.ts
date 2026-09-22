import { createBrowserClient } from '@supabase/ssr'

/** Client de Supabase per als components que s'executen al navegador. */
export function clientNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
