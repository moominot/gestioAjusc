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

export type ResultatFusio =
  | { ok: true; bo: number; nom: string; duplicat: number; nomDuplicat: string }
  | { ok: false; error: string }

/**
 * Fusiona el duplicat dins el bo: partides, inscripcions, historial del BARRUF,
 * quotes i àlies. El número del duplicat queda reservat i redirigeix al bo.
 */
export async function fusionaJugadors(bo: number, duplicat: number): Promise<ResultatFusio> {
  if (!(await gestorConnectat())) return { ok: false, error: 'Cal haver entrat com a gestor.' }

  const supabase = await clientServidor()
  const { data, error } = await supabase.rpc('fusiona_jugadors', { p_bo: bo, p_duplicat: duplicat })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/gestio/jugadors')
  revalidatePath('/gestio/jugadors/duplicats')
  revalidatePath('/barruf')
  revalidatePath('/campionats')
  revalidatePath(`/jugadors/${bo}`)
  revalidatePath(`/jugadors/${duplicat}`)

  const r = data as { bo: number; nom: string; duplicat: number; nom_duplicat: string }
  return { ok: true, bo: r.bo, nom: r.nom, duplicat: r.duplicat, nomDuplicat: r.nom_duplicat }
}

/** Marca una parella com a dues persones diferents, perquè no torni a sortir. */
export async function descartaDuplicat(a: number, b: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await gestorConnectat())) return { ok: false, error: 'Cal haver entrat com a gestor.' }

  const supabase = await clientServidor()
  const { error } = await supabase.rpc('descarta_duplicat', { p_numero_a: a, p_numero_b: b })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/gestio/jugadors/duplicats')
  return { ok: true }
}
