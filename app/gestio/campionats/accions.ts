'use server'

import { revalidatePath } from 'next/cache'

import { clientServidor, gestorConnectat } from '../../../lib/supabase/servidor'

export type Resultat = { ok: true } | { ok: false; error: string }

export interface DadesEditables {
  nom: string
  data: string
  temporadaCodi: string
  organitzador: string
  clubOrganitzador: string
  rondesPrevistes: number | null
  notes: string
  computaBarruf: boolean
  motiuNoComputa: string
  finalitzat: boolean
}

function revalida(id: string) {
  revalidatePath(`/campionats/${id}`)
  revalidatePath(`/gestio/campionats/${id}`)
  revalidatePath('/campionats')
}

/** Desa les dades d'un campionat. L'RLS només ho deixa fer als gestors. */
export async function desaCampionat(id: string, dades: DadesEditables): Promise<Resultat> {
  if (!(await gestorConnectat())) return { ok: false, error: 'Cal haver entrat com a gestor.' }
  if (!dades.nom.trim()) return { ok: false, error: 'El campionat necessita un nom.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dades.data)) return { ok: false, error: 'La data no és vàlida.' }
  if (!dades.computaBarruf && !dades.motiuNoComputa.trim()) {
    return { ok: false, error: 'Si no computa per al BARRUF, cal dir-ne el motiu.' }
  }

  const supabase = await clientServidor()

  let clubId: string | null = null
  const club = dades.clubOrganitzador.trim()
  if (club) {
    const { data } = await supabase.from('clubs').select('id').ilike('nom', club).maybeSingle()
    if (data) clubId = data.id as string
    else {
      const { data: nou, error } = await supabase.from('clubs').insert({ nom: club }).select('id').single()
      if (error) return { ok: false, error: error.message }
      clubId = nou.id as string
    }
  }

  const { error } = await supabase
    .from('campionats')
    .update({
      nom: dades.nom.trim(),
      data: dades.data,
      temporada_codi: dades.temporadaCodi,
      organitzador: dades.organitzador.trim() || null,
      club_organitzador_id: clubId,
      rondes_previstes: dades.rondesPrevistes,
      notes: dades.notes.trim() || null,
      computa_barruf: dades.computaBarruf,
      motiu_no_computa: dades.computaBarruf ? null : dades.motiuNoComputa.trim(),
      finalitzat: dades.finalitzat,
      modificat_el: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return {
      ok: false,
      error: error.message.includes('campionats_ordre_cadena_idx')
        ? 'Ja hi ha un altre campionat amb la mateixa data i el mateix ordre.'
        : error.message,
    }
  }

  revalida(id)
  return { ok: true }
}

/**
 * Corregeix el resultat d'una partida.
 *
 * Si hi ha puntuació, el resultat en surt sol: guanya qui fa més punts. Si no,
 * es fa servir el que s'hagi triat (1, ½ o 0).
 */
export async function desaPartida(
  campionatId: string,
  partidaId: string,
  punts1: number | null,
  punts2: number | null,
  resultat1: number,
): Promise<Resultat> {
  if (!(await gestorConnectat())) return { ok: false, error: 'Cal haver entrat com a gestor.' }
  if ((punts1 === null) !== (punts2 === null)) {
    return { ok: false, error: 'Cal la puntuació dels dos jugadors, o de cap.' }
  }
  if ([punts1, punts2].some((p) => p !== null && (!Number.isInteger(p) || p < 0))) {
    return { ok: false, error: 'Les puntuacions han de ser nombres enters positius.' }
  }

  const resultat =
    punts1 !== null && punts2 !== null ? (punts1 > punts2 ? 1 : punts1 < punts2 ? 0 : 0.5) : resultat1
  if (![0, 0.5, 1].includes(resultat)) return { ok: false, error: 'El resultat ha de ser 1, ½ o 0.' }

  const supabase = await clientServidor()
  const { error } = await supabase
    .from('partides')
    .update({ punts_1: punts1, punts_2: punts2, resultat_1: resultat })
    .eq('id', partidaId)
    .eq('campionat_id', campionatId)

  if (error) return { ok: false, error: error.message }
  revalida(campionatId)
  return { ok: true }
}
