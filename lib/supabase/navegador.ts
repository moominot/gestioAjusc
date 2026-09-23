import { createBrowserClient } from '@supabase/ssr'

import { configuracioSupabase } from './configuracio'

/** Client de Supabase per als components que s'executen al navegador. */
export function clientNavegador() {
  const { url, clau } = configuracioSupabase()
  return createBrowserClient(url, clau)
}
