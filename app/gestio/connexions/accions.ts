'use server'

import { revalidatePath } from 'next/cache'

import { clientServidor, gestorConnectat } from '../../../lib/supabase/servidor'

export type ResultatConnexio = { ok: true; clau: string } | { ok: false; error: string }

/** Crea una connexió. La clau es torna aquest cop i prou: no es desa enlloc. */
export async function creaConnexio(nom: string): Promise<ResultatConnexio> {
  if (!(await gestorConnectat())) return { ok: false, error: 'Cal haver entrat com a gestor.' }
  const supabase = await clientServidor()
  const { data, error } = await supabase.rpc('crea_connexio', { p_nom: nom })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/gestio/connexions')
  return { ok: true, clau: (data as { clau: string }).clau }
}

export async function revocaConnexio(dades: FormData) {
  if (!(await gestorConnectat())) return
  const supabase = await clientServidor()
  await supabase.rpc('revoca_connexio', { p_id: String(dades.get('id')) })
  revalidatePath('/gestio/connexions')
}
