'use server'

import { revalidatePath } from 'next/cache'

import { clientServidor, gestorConnectat } from '../../../lib/supabase/servidor'
import { invalidaEstadistiques } from '../../../lib/estadistiques/invalida'

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
  invalidaEstadistiques()
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

/** Tot el que es pot editar d'una partida. Els jugadors, pel número del registre. */
export interface DadesPartida {
  ronda: number
  jugador1: number
  /** `null` si el jugador 1 descansa. */
  jugador2: number | null
  punts1: number | null
  punts2: number | null
  /** El del jugador 1: 1, ½ o 0; `null` si no se sap. Amb puntuació, es dedueix. */
  resultat1: number | null
  scrabbles1: number | null
  scrabbles2: number | null
  mot1: string
  puntsMot1: number | null
  motLletra1: string
  puntsLletra1: number | null
  mot2: string
  puntsMot2: number | null
  motLletra2: string
  puntsLletra2: number | null
  /** Dades lliures: enllaç al full o al tauler, taula, lloc, comentaris... */
  dades: Record<string, unknown> | null
}

const enterPositiu = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0)

/** Comprova les dades i les passa a columnes de `partides`, sense els jugadors. */
function columnesPartida(d: DadesPartida): { ok: true; fila: Record<string, unknown> } | { ok: false; error: string } {
  if (!Number.isInteger(d.ronda) || d.ronda < 1) return { ok: false, error: 'La ronda ha de ser un nombre a partir de 1.' }
  if (d.jugador2 !== null && d.jugador1 === d.jugador2) {
    return { ok: false, error: 'Un jugador no pot jugar contra si mateix.' }
  }
  if ((d.punts1 === null) !== (d.punts2 === null)) {
    return { ok: false, error: 'Cal la puntuació dels dos jugadors, o de cap.' }
  }
  const xifres = [d.punts1, d.punts2, d.scrabbles1, d.scrabbles2, d.puntsMot1, d.puntsLletra1, d.puntsMot2, d.puntsLletra2]
  if (!xifres.every(enterPositiu)) return { ok: false, error: 'Les xifres han de ser nombres enters positius.' }

  const mot = (m: string) => m.trim().toUpperCase() || null
  // En un descans compta com a victòria i no hi ha res més a desar.
  const descans = d.jugador2 === null
  const resultat = descans
    ? 1
    : d.punts1 !== null && d.punts2 !== null
      ? d.punts1 > d.punts2
        ? 1
        : d.punts1 < d.punts2
          ? 0
          : 0.5
      : d.resultat1
  if (resultat !== null && ![0, 0.5, 1].includes(resultat)) return { ok: false, error: 'El resultat ha de ser 1, ½ o 0.' }

  return {
    ok: true,
    fila: {
      ronda: d.ronda,
      dades: d.dades && Object.keys(d.dades).length ? d.dades : null,
      resultat_1: resultat,
      punts_1: descans ? null : d.punts1,
      punts_2: descans ? null : d.punts2,
      scrabbles_1: descans ? null : d.scrabbles1,
      scrabbles_2: descans ? null : d.scrabbles2,
      mot_1: descans ? null : mot(d.mot1),
      punts_mot_1: descans ? null : d.puntsMot1,
      mot_lletra_1: descans ? null : mot(d.motLletra1),
      punts_lletra_1: descans ? null : d.puntsLletra1,
      mot_2: descans ? null : mot(d.mot2),
      punts_mot_2: descans ? null : d.puntsMot2,
      mot_lletra_2: descans ? null : mot(d.motLletra2),
      punts_lletra_2: descans ? null : d.puntsLletra2,
    },
  }
}

type Client = Awaited<ReturnType<typeof clientServidor>>

/** L'id de cada jugador de la partida, a partir del número. */
async function idsJugadors(supabase: Client, d: DadesPartida): Promise<[string, string | null]> {
  const numeros = d.jugador2 === null ? [d.jugador1] : [d.jugador1, d.jugador2]
  const { data, error } = await supabase.from('jugadors').select('id, numero').in('numero', numeros)
  if (error) throw new Error(error.message)
  const ids = new Map((data ?? []).map((j) => [j.numero as number, j.id as string]))
  const falta = numeros.find((n) => !ids.has(n))
  if (falta !== undefined) throw new Error(`No hi ha cap jugador amb el número ${falta}.`)
  return [ids.get(d.jugador1)!, d.jugador2 === null ? null : ids.get(d.jugador2)!]
}

const nonuls = (ids: (string | null | undefined)[]) => ids.filter((x): x is string => !!x)

/**
 * Les inscripcions han de seguir les partides: qui hi juga hi ha d'estar
 * inscrit, i qui ja no hi juga cap partida en surt.
 */
async function ajustaInscripcions(supabase: Client, campionatId: string, abans: string[], ara: string[]) {
  if (ara.length) {
    const { error } = await supabase
      .from('inscripcions')
      .upsert(
        ara.map((jugador_id) => ({ campionat_id: campionatId, jugador_id })),
        { onConflict: 'campionat_id,jugador_id', ignoreDuplicates: true },
      )
    if (error) throw new Error(error.message)
  }
  for (const id of abans.filter((j) => !ara.includes(j))) {
    const { count } = await supabase
      .from('partides')
      .select('id', { count: 'exact', head: true })
      .eq('campionat_id', campionatId)
      .or(`jugador_1_id.eq.${id},jugador_2_id.eq.${id}`)
    if (count === 0) await supabase.from('inscripcions').delete().eq('campionat_id', campionatId).eq('jugador_id', id)
  }
}

const missatgeError = (e: string) =>
  /ronda/i.test(e) && /jugador/i.test(e) ? 'Algun dels jugadors ja té una altra partida en aquesta ronda.' : e

async function jugadorsDe(supabase: Client, campionatId: string, partidaId: string) {
  const { data } = await supabase
    .from('partides')
    .select('jugador_1_id, jugador_2_id')
    .eq('id', partidaId)
    .eq('campionat_id', campionatId)
    .maybeSingle()
  return data ? nonuls([data.jugador_1_id as string, data.jugador_2_id as string | null]) : null
}

/** Desa una partida sencera: jugadors, ronda, resultat, puntuació i estadístiques. */
export async function desaPartida(campionatId: string, partidaId: string, d: DadesPartida): Promise<Resultat> {
  if (!(await gestorConnectat())) return { ok: false, error: 'Cal haver entrat com a gestor.' }
  const c = columnesPartida(d)
  if (!c.ok) return c

  const supabase = await clientServidor()
  try {
    const abans = await jugadorsDe(supabase, campionatId, partidaId)
    if (!abans) return { ok: false, error: 'Aquesta partida ja no existeix.' }
    const [j1, j2] = await idsJugadors(supabase, d)
    // Primer les inscripcions noves: la partida no pot apuntar a un no inscrit.
    await ajustaInscripcions(supabase, campionatId, [], nonuls([j1, j2]))
    const { error } = await supabase
      .from('partides')
      .update({ ...c.fila, jugador_1_id: j1, jugador_2_id: j2 })
      .eq('id', partidaId)
      .eq('campionat_id', campionatId)
    if (error) {
      // No ha anat bé: fora les inscripcions que s'acabaven de fer.
      await ajustaInscripcions(supabase, campionatId, nonuls([j1, j2]).filter((j) => !abans.includes(j)), [])
      return { ok: false, error: missatgeError(error.message) }
    }
    await ajustaInscripcions(supabase, campionatId, abans, nonuls([j1, j2]))
  } catch (e) {
    return { ok: false, error: missatgeError((e as Error).message) }
  }
  revalida(campionatId)
  return { ok: true }
}

/** Afegeix una partida al campionat. */
export async function afegeixPartida(campionatId: string, d: DadesPartida): Promise<Resultat> {
  if (!(await gestorConnectat())) return { ok: false, error: 'Cal haver entrat com a gestor.' }
  const c = columnesPartida(d)
  if (!c.ok) return c

  const supabase = await clientServidor()
  try {
    const [j1, j2] = await idsJugadors(supabase, d)
    await ajustaInscripcions(supabase, campionatId, [], nonuls([j1, j2]))
    const { error } = await supabase
      .from('partides')
      .insert({ ...c.fila, campionat_id: campionatId, jugador_1_id: j1, jugador_2_id: j2 })
    if (error) {
      await ajustaInscripcions(supabase, campionatId, nonuls([j1, j2]), [])
      return { ok: false, error: missatgeError(error.message) }
    }
  } catch (e) {
    return { ok: false, error: missatgeError((e as Error).message) }
  }
  revalida(campionatId)
  return { ok: true }
}

/** Esborra una partida; qui es queda sense cap partida surt dels inscrits. */
export async function esborraPartida(campionatId: string, partidaId: string): Promise<Resultat> {
  if (!(await gestorConnectat())) return { ok: false, error: 'Cal haver entrat com a gestor.' }
  const supabase = await clientServidor()
  try {
    const abans = await jugadorsDe(supabase, campionatId, partidaId)
    if (!abans) return { ok: false, error: 'Aquesta partida ja no existeix.' }
    const { error } = await supabase.from('partides').delete().eq('id', partidaId).eq('campionat_id', campionatId)
    if (error) return { ok: false, error: error.message }
    await ajustaInscripcions(supabase, campionatId, abans, [])
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  revalida(campionatId)
  return { ok: true }
}
