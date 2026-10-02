import { createServerClient } from '@supabase/ssr'

import { configuracioSupabase } from './configuracio'

/**
 * Client de Supabase sense galetes, com un visitant anònim. Per a dades
 * públiques que no depenen de qui mira (estadístiques, l'API pública) i per
 * a les funcions de l'API que comproven elles mateixes una clau.
 */
export function clientAnonim() {
  const { url, clau } = configuracioSupabase()
  return createServerClient(url, clau, { cookies: { getAll: () => [], setAll: () => {} } })
}
