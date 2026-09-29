'use server'

import { revalidatePath } from 'next/cache'

import { clientServidor, gestorConnectat } from '../../../lib/supabase/servidor'

export type ResultatEdicio =
  | { ok: true; numero: number; nom: string; club: string | null }
  | { ok: false; error: string }

/**
 * Canvia el nom i el club d'un jugador. La base de dades en conserva el nom
 * d'abans com a àlies i no deixa posar-li el d'un altre jugador.
 */
export async function editaJugador(numero: number, nom: string, club: string): Promise<ResultatEdicio> {
  if (!(await gestorConnectat())) return { ok: false, error: 'Cal haver entrat com a gestor.' }

  const supabase = await clientServidor()
  const { data, error } = await supabase.rpc('edita_jugador', {
    p_numero: numero,
    p_nom: nom,
    p_club: club,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/gestio/jugadors')
  revalidatePath('/barruf')
  revalidatePath(`/jugadors/${numero}`)

  const desat = data as { numero: number; nom: string; club: string | null }
  return { ok: true, ...desat }
}
