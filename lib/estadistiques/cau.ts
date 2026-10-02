import { createServerClient } from '@supabase/ssr'
import { unstable_cache } from 'next/cache'

import { configuracioSupabase } from '../supabase/configuracio'

/**
 * Les estadístiques són de lectura pública i no depenen de qui mira: es poden
 * calcular sense galetes i guardar una estona. Les més lentes (el Saló de la
 * fama) així només es calculen un cop per hora.
 */
function clientAnonim() {
  const { url, clau } = configuracioSupabase()
  return createServerClient(url, clau, { cookies: { getAll: () => [], setAll: () => {} } })
}

export const estadistica = unstable_cache(
  async (metrica: string, filtres: Record<string, string>, limit: number) => {
    const { data, error } = await clientAnonim().rpc('estadistica', { p_metrica: metrica, p_filtres: filtres, p_limit: limit })
    if (error) throw new Error(error.message)
    return (data ?? []) as Record<string, unknown>[]
  },
  ['estadistica'],
  { revalidate: 600, tags: ['estadistiques'] },
)

export const salo = unstable_cache(
  async () => {
    const { data, error } = await clientAnonim().rpc('estadistica_salo')
    if (error) throw new Error(error.message)
    return (data ?? {}) as Record<string, Record<string, unknown> | null>
  },
  ['estadistica_salo'],
  { revalidate: 3600, tags: ['estadistiques'] },
)

/** Les llistes de la barra de filtres. */
export const opcionsFiltres = unstable_cache(
  async () => {
    const s = clientAnonim()
    const [t, c, cp, j] = await Promise.all([
      s.from('temporades').select('codi').order('codi'),
      s.from('clubs').select('nom').order('nom'),
      s.from('campionats_publics').select('id, nom, temporada_codi').order('data'),
      s.from('barruf_classificacio').select('jugador_numero, nom_complet, club').order('nom_complet'),
    ])
    return {
      temporades: (t.data ?? []).map((r) => r.codi as string),
      clubs: (c.data ?? []).map((r) => r.nom as string),
      campionats: (cp.data ?? []).map((r) => ({ id: r.id as string, nom: r.nom as string, temporada: r.temporada_codi as string })),
      registre: (j.data ?? []).map((r) => ({
        numero: r.jugador_numero as number,
        nom: r.nom_complet as string,
        club: (r.club as string | null) ?? null,
      })),
    }
  },
  ['opcions_filtres'],
  { revalidate: 600, tags: ['estadistiques'] },
)
