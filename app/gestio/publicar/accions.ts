'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

import { calculaEdicio, type JugadorLlavor } from '../../../lib/barruf/publicacio'
import type { CampionatEntrada, Resultat } from '../../../lib/barruf/tipus'
import { clientServidor, gestorConnectat } from '../../../lib/supabase/servidor'

/** El número del jugador fa d'identificador dins del motor. */
const clau = (numero: number) => String(numero)

interface DadesCrues {
  llavor: {
    jugador_numero: number
    barruf: string
    partides_totals: number
    victories_totals: string
    partides_temporada: number
    victories_temporada: string
    darrera_temporada: string | null
    cohort_llegat: boolean
  }[]
  ultima_edicio: number
  campionats: {
    id: string
    nom: string
    data: string
    ordre: number
    temporada_codi: string
    /** Null si encara no l'ha computat cap edició: és dels nous. */
    primera_edicio: number | null
    inscrits: number[]
    partides: {
      ronda: number
      jugador_1: number
      jugador_2: number | null
      resultat_1: string
    }[]
  }[]
}

export interface CanviJugador {
  numero: number
  nom: string
  barrufAbans: number
  barrufDespres: number
  variacio: number
  estatAbans: string | null
  estatDespres: string
  posicio: number | null
}

export interface Previsualitzacio {
  numeroProposat: number
  temporada: string
  campionats: { id: string; nom: string; data: string }[]
  /** Els que entren per primer cop en aquesta edició. */
  campionatsNous: { id: string; nom: string; data: string }[]
  totalJugadors: number
  actius: number
  ambVariacio: number
  canvisDEstat: CanviJugador[]
  majorsPujades: CanviJugador[]
  majorsBaixades: CanviJugador[]
  /**
   * Jugadors que no juguen cap campionat nou però el BARRUF dels quals canvia
   * respecte de l'última edició: correccions de dades anteriors (fusions,
   * resultats corregits) que, en rejugar la cadena, els toquen de retruc.
   */
  correccions: CanviJugador[]
}

export type ResultatPrevi =
  | { ok: true; previsualitzacio: Previsualitzacio }
  | { ok: false; error: string }

async function recalcula(temporadaActual: string) {
  const supabase = await clientServidor()
  const { data, error } = await supabase.rpc('dades_per_recalcular')
  if (error) throw new Error(error.message)

  const crues = data as DadesCrues
  if (crues.llavor.length === 0) {
    throw new Error('No hi ha cap edició llavor: cal aplicar la migració de la llavor.')
  }

  const llavor: JugadorLlavor[] = crues.llavor.map((j) => ({
    jugadorId: clau(j.jugador_numero),
    barruf: Number(j.barruf),
    partidesTotals: j.partides_totals,
    victoriesTotals: Number(j.victories_totals),
    partidesTemporada: j.partides_temporada,
    victoriesTemporada: Number(j.victories_temporada),
    darreraTemporada: j.darrera_temporada,
    cohortLlegat: j.cohort_llegat,
  }))

  const campionats: CampionatEntrada[] = crues.campionats.map((c) => ({
    id: c.id,
    temporadaCodi: c.temporada_codi,
    inscrits: c.inscrits.map(clau),
    partides: c.partides.map((p) => ({
      ronda: p.ronda,
      jugador1Id: clau(p.jugador_1),
      jugador2Id: p.jugador_2 === null ? null : clau(p.jugador_2),
      resultat1: Number(p.resultat_1) as Resultat,
    })),
  }))

  return { crues, llavor, edicio: calculaEdicio(llavor, campionats, temporadaActual) }
}

/** Calcula què passaria, sense desar res. */
export async function previsualitza(temporadaActual: string): Promise<ResultatPrevi> {
  if (!(await gestorConnectat())) return { ok: false, error: 'Cal haver entrat com a gestor.' }

  try {
    const { crues, llavor, edicio } = await recalcula(temporadaActual)

    const supabase = await clientServidor()
    const [{ data: jugadors }, { data: ultima }] = await Promise.all([
      supabase.from('jugadors_publics').select('numero, nom_complet'),
      // L'última edició publicada: és amb la que es compara.
      supabase.from('barruf_classificacio').select('jugador_numero, barruf'),
    ])
    const noms = new Map((jugadors ?? []).map((j) => [String(j.numero), j.nom_complet as string]))

    // Amb l'última edició si n'hi ha; si no, amb la llavor.
    const abansPerJugador = new Map<string, { barruf: number }>(llavor.map((j) => [j.jugadorId, j]))
    for (const u of ultima ?? []) abansPerJugador.set(clau(u.jugador_numero as number), { barruf: Number(u.barruf) })

    // Qui juga algun campionat nou.
    const nous = crues.campionats.filter((c) => c.primera_edicio === null)
    const juguenNou = new Set(nous.flatMap((c) => (edicio.variacions.get(c.id) ?? []).map((v) => v.jugadorId)))
    const estatsAbans = new Map(
      crues.llavor.map((j) => [clau(j.jugador_numero), j.cohort_llegat ? 'inact' : null]),
    )

    const canvis: CanviJugador[] = edicio.valors.map((valor) => {
      const abans = abansPerJugador.get(valor.jugadorId)
      return {
        numero: Number(valor.jugadorId),
        nom: noms.get(valor.jugadorId) ?? valor.jugadorId,
        barrufAbans: abans?.barruf ?? valor.barruf,
        barrufDespres: valor.barruf,
        variacio: valor.barruf - (abans?.barruf ?? valor.barruf),
        estatAbans: estatsAbans.get(valor.jugadorId) ?? null,
        estatDespres: valor.estat,
        posicio: valor.posicio,
      }
    })

    const ambVariacio = canvis.filter((c) => Math.abs(c.variacio) > 1e-9)
    const correccions = canvis
      .filter((c) => !juguenNou.has(clau(c.numero)) && Math.round(c.barrufDespres) !== Math.round(c.barrufAbans))
      .sort((a, b) => Math.abs(b.variacio) - Math.abs(a.variacio) || a.nom.localeCompare(b.nom, 'ca'))
    const perVariacio = [...ambVariacio].sort((a, b) => b.variacio - a.variacio)

    return {
      ok: true,
      previsualitzacio: {
        numeroProposat: crues.ultima_edicio + 1,
        temporada: temporadaActual,
        campionats: crues.campionats.map((c) => ({ id: c.id, nom: c.nom, data: c.data })),
        campionatsNous: nous.map((c) => ({ id: c.id, nom: c.nom, data: c.data })),
        totalJugadors: edicio.valors.length,
        actius: edicio.valors.filter((v) => v.estat === 'act').length,
        ambVariacio: ambVariacio.length,
        canvisDEstat: [],
        majorsPujades: perVariacio.slice(0, 10),
        majorsBaixades: perVariacio.slice(-10).reverse(),
        correccions,
      },
    }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

export type ResultatPublicacio =
  | { ok: true; numero: number; valors: number; variacions: number }
  | { ok: false; error: string }

/** Rejuga la cadena i desa l'edició nova. */
export async function publica(
  temporadaActual: string,
  dataPublicacio: string,
): Promise<ResultatPublicacio> {
  if (!(await gestorConnectat())) return { ok: false, error: 'Cal haver entrat com a gestor.' }

  try {
    const { crues, edicio } = await recalcula(temporadaActual)

    const variacions = [...edicio.variacions.entries()].flatMap(([campionatId, files]) =>
      files.map((v) => ({
        campionat_id: campionatId,
        jugador_numero: Number(v.jugadorId),
        barruf_abans: v.barrufAbans,
        partides: v.partides,
        victories: v.victories,
        esperanca: v.esperanca,
        factor_k: v.factorK,
        variacio: v.variacio,
        barruf_despres: v.barrufDespres,
      })),
    )

    const supabase = await clientServidor()
    const { data, error } = await supabase.rpc('publica_edicio', {
      p_edicio: {
        numero: crues.ultima_edicio + 1,
        data_publicacio: dataPublicacio,
        temporada_codi: temporadaActual,
        descripcio: `Rejugats ${crues.campionats.length} campionats des de la llavor.`,
      },
      p_valors: edicio.valors.map((v) => ({
        jugador_numero: Number(v.jugadorId),
        barruf: v.barruf,
        partides_totals: v.partidesTotals,
        victories_totals: v.victoriesTotals,
        partides_temporada: v.partidesTemporada,
        victories_temporada: v.victoriesTemporada,
        estat: v.estat,
        darrera_temporada: v.darreraTemporada,
        cohort_llegat: v.cohortLlegat,
        posicio: v.posicio,
        debutant: v.debutant,
      })),
      p_variacions: variacions,
    })

    if (error) return { ok: false, error: error.message }

    revalidatePath('/')
    revalidatePath('/barruf')
    revalidateTag('estadistiques', 'max')
    revalidatePath('/gestio')

    const resum = data as { numero: number; valors: number; variacions: number }
    return { ok: true, numero: resum.numero, valors: resum.valors, variacions: resum.variacions }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

export type ResultatDespublicacio =
  | { ok: true; numero: number; campionats: number; noms: string | null }
  | { ok: false; error: string }

/**
 * Desfà l'última edició publicada. Els campionats que hi havien entrat tornen
 * a quedar pendents; es corregeix el que calgui i es torna a publicar.
 */
export async function despublica(numero: number): Promise<ResultatDespublicacio> {
  if (!(await gestorConnectat())) return { ok: false, error: 'Cal haver entrat com a gestor.' }

  const supabase = await clientServidor()
  const { data, error } = await supabase.rpc('despublica_ultima_edicio', { p_numero: numero })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/')
  revalidatePath('/barruf')
  revalidateTag('estadistiques', 'max')
  revalidatePath('/campionats')
  revalidatePath('/gestio')
  revalidatePath('/gestio/publicar')

  const r = data as { numero: number; campionats: number; noms: string | null }
  return { ok: true, numero: r.numero, campionats: r.campionats, noms: r.noms }
}
