'use server'

import { revalidatePath } from 'next/cache'

import type { JugadorCercable } from '../../../components/CercaJugador'
import { llegeixFitxerDeResultats } from '../../../lib/importacio/fitxers'
import { construeixTorneigDeFull } from '../../../lib/importacio/fulls'
import { resolNoms, type JugadorRegistre } from '../../../lib/importacio/resolucio'
import {
  llegeixTorneig,
  type EstadistiquesPartida,
  type Torneig,
} from '../../../lib/importacio/torneig'
import { clientServidor, gestorConnectat } from '../../../lib/supabase/servidor'

export interface ParticipantProposat {
  localId: number
  nom: string
  puntuacioInicial: number | null
  partides: number
  /** Número del registre si s'ha resolt tot sol, o null si cal decidir-ho. */
  jugadorNumero: number | null
  /** Com s'ha resolt: exacte, alies, dubtos o nou. */
  com: 'exacte' | 'alies' | 'dubtos' | 'nou'
  candidats: { numero: number; nom: string; semblanca: number; corroborat: boolean }[]
}

export interface PartidaProposada {
  ronda: number
  local1: number
  local2: number | null
  resultat1: number
  punts1: number | null
  punts2: number | null
  estadistiques: EstadistiquesPartida | null
}

export interface Proposta {
  origen: 'swissperfect' | 'full'
  nom: string
  organitzador: string
  rondesPrevistes: number | null
  rondesJugades: number
  rondesPendents: number[]
  pestanya: string | null
  rondesDeduides: boolean
  rondesPerBlocs: boolean
  /** Quantes partides porten scrabbles o millors jugades. */
  ambEstadistiques: number
  participants: ParticipantProposat[]
  partides: PartidaProposada[]
}

export type ResultatAnalisi =
  | { ok: true; proposta: Proposta; registre: JugadorCercable[] }
  | { ok: false; error: string }

async function bytes(fitxer: File): Promise<Uint8Array> {
  return new Uint8Array(await fitxer.arrayBuffer())
}

const teContingut = (fitxer: unknown): fitxer is File =>
  fitxer instanceof File && fitxer.size > 0

/** Llegeix els fitxers, resol els noms i torna una proposta per revisar. */
export async function analitza(dades: FormData): Promise<ResultatAnalisi> {
  if (!(await gestorConnectat())) return { ok: false, error: 'Cal haver entrat com a gestor.' }

  try {
    const trn = dades.get('trn')
    const sco = dades.get('sco')
    const ini = dades.get('ini')
    const full = dades.get('full')

    let torneig: Torneig
    let origen: Proposta['origen']
    let pestanya: string | null = null
    let rondesDeduides = false
    let rondesPerBlocs = false

    if (teContingut(trn) || teContingut(sco)) {
      if (!teContingut(trn) || !teContingut(sco)) {
        return { ok: false, error: 'Del SwissPerfect calen el fitxer .trn i el .sco.' }
      }
      torneig = llegeixTorneig({
        trn: await bytes(trn),
        sco: await bytes(sco),
        ini: teContingut(ini) ? new TextDecoder('windows-1252').decode(await bytes(ini)) : undefined,
      })
      origen = 'swissperfect'
    } else if (teContingut(full)) {
      const llegit = await llegeixFitxerDeResultats(full.name, await bytes(full))
      const delFull = construeixTorneigDeFull(llegit.files)
      torneig = delFull
      origen = 'full'
      pestanya = llegit.pestanya
      rondesDeduides = delFull.rondesDeduides
      rondesPerBlocs = delFull.rondesPerBlocs
    } else {
      return { ok: false, error: 'Cal pujar els fitxers del SwissPerfect o bé un full de càlcul.' }
    }

    // Registre contra el qual resoldre els noms.
    const supabase = await clientServidor()
    const [{ data: jugadors }, { data: alies }] = await Promise.all([
      supabase.from('jugadors').select('id, numero, nom_complet, clubs(nom)').is('fusionat_a', null),
      supabase.from('jugador_alies').select('jugador_id, alies_norm'),
    ])

    const { data: barrufs } = await supabase
      .from('barruf_classificacio')
      .select('jugador_numero, barruf')

    const barrufPerNumero = new Map(
      (barrufs ?? []).map((b) => [b.jugador_numero as number, Number(b.barruf)]),
    )

    const registre: JugadorRegistre[] = (jugadors ?? []).map((j) => ({
      id: j.id as string,
      numero: j.numero as number,
      nomComplet: j.nom_complet as string,
      barruf: barrufPerNumero.get(j.numero as number) ?? null,
    }))
    const perId = new Map(registre.map((j) => [j.id, j]))

    const resolts = resolNoms(
      torneig.participants.map((p) => ({
        origen: p,
        nom: p.nomComplet,
        puntuacioInicial: p.puntuacioInicial,
      })),
      {
        jugadors: registre,
        alies: (alies ?? []).map((a) => ({
          jugadorId: a.jugador_id as string,
          aliesNorm: a.alies_norm as string,
        })),
      },
    )

    const partidesPer = new Map<number, number>()
    for (const partida of torneig.partides) {
      for (const jugador of [partida.blancId, partida.negreId]) {
        partidesPer.set(jugador, (partidesPer.get(jugador) ?? 0) + 1)
      }
    }

    const participants: ParticipantProposat[] = resolts.map((resolt) => {
      const { resolucio } = resolt
      const resolt_ =
        resolucio.tipus === 'exacte' || resolucio.tipus === 'alies' ? resolucio.jugador : null

      return {
        localId: resolt.origen.id,
        nom: resolt.nom,
        puntuacioInicial: resolt.origen.puntuacioInicial,
        partides: partidesPer.get(resolt.origen.id) ?? 0,
        jugadorNumero: resolt_?.numero ?? null,
        com: resolucio.tipus,
        candidats:
          resolucio.tipus === 'dubtos' || resolucio.tipus === 'nou'
            ? resolucio.candidats.map((c) => ({
                numero: c.jugador.numero,
                nom: perId.get(c.jugador.id)?.nomComplet ?? c.jugador.nomComplet,
                semblanca: Math.round(c.semblanca * 100),
                corroborat: c.unicAmbAquestaPuntuacio,
              }))
            : [],
      }
    })

    return {
      ok: true,
      // El registre sencer, per poder triar a mà un jugador que la resolució no ha proposat.
      registre: (jugadors ?? []).map((j) => ({
        numero: j.numero as number,
        nom: j.nom_complet as string,
        club: (j.clubs as unknown as { nom: string } | null)?.nom ?? null,
      })),
      proposta: {
        origen,
        nom: torneig.info?.nom ?? '',
        organitzador: torneig.info?.organitzador ?? '',
        rondesPrevistes: torneig.info?.rondesPrevistes ?? null,
        rondesJugades: torneig.rondesJugades.length,
        rondesPendents: torneig.rondesPendents,
        pestanya,
        rondesDeduides,
        rondesPerBlocs,
        ambEstadistiques: torneig.partides.filter((p) => p.estadistiques).length,
        participants,
        partides: torneig.partides.map((p) => ({
          ronda: p.ronda,
          local1: p.blancId,
          local2: p.negreId,
          resultat1: p.resultatBlanc,
          punts1: p.puntsBlanc,
          punts2: p.puntsNegre,
          estadistiques: p.estadistiques ?? null,
        })),
      },
    }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

/** Els participants tal com els vol la base de dades, amb el que hagi decidit el gestor. */
function participantsPerDesar(proposta: Proposta, decisions: Record<number, number | null>) {
  return proposta.participants.map((participant) => ({
    local_id: String(participant.localId),
    nom: participant.nom,
    jugador_numero:
      participant.localId in decisions
        ? decisions[participant.localId]
        : participant.jugadorNumero,
  }))
}

/** Les partides tal com les vol la base de dades, amb les estadístiques aplanades. */
function partidesPerDesar(proposta: Proposta) {
  return proposta.partides.map((p) => {
    const e = p.estadistiques
    return {
      ronda: p.ronda,
      local_1: String(p.local1),
      local_2: p.local2 === null ? null : String(p.local2),
      resultat_1: p.resultat1,
      punts_1: p.punts1,
      punts_2: p.punts2,
      scrabbles_1: e?.jugador1.scrabbles ?? null,
      scrabbles_2: e?.jugador2.scrabbles ?? null,
      mot_1: e?.jugador1.mot ?? null,
      punts_mot_1: e?.jugador1.puntsMot ?? null,
      mot_lletra_1: e?.jugador1.motLletra ?? null,
      punts_lletra_1: e?.jugador1.puntsLletra ?? null,
      mot_2: e?.jugador2.mot ?? null,
      punts_mot_2: e?.jugador2.puntsMot ?? null,
      mot_lletra_2: e?.jugador2.motLletra ?? null,
      punts_lletra_2: e?.jugador2.puntsLletra ?? null,
    }
  })
}

export interface DadesCampionat {
  nom: string
  data: string
  temporadaCodi: string
  organitzador: string
  computaBarruf: boolean
  motiuNoComputa: string
  finalitzat: boolean
}

export type ResultatDesat =
  | { ok: true; campionatId: string; participants: number; jugadorsNous: number; partides: number }
  | { ok: false; error: string }

/** Desa el campionat, els participants i les partides en una sola operació. */
export async function desa(
  proposta: Proposta,
  campionat: DadesCampionat,
  decisions: Record<number, number | null>,
): Promise<ResultatDesat> {
  if (!(await gestorConnectat())) return { ok: false, error: 'Cal haver entrat com a gestor.' }

  if (!campionat.nom.trim()) return { ok: false, error: 'El campionat necessita un nom.' }
  if (!campionat.data) return { ok: false, error: 'El campionat necessita una data.' }
  if (!campionat.computaBarruf && !campionat.motiuNoComputa.trim()) {
    return { ok: false, error: 'Si el campionat no computa, cal dir-ne el motiu.' }
  }

  const participants = participantsPerDesar(proposta, decisions)
  const altesNoves = participants.filter((p) => p.jugador_numero === null).length

  const supabase = await clientServidor()
  const { data, error } = await supabase.rpc('importa_campionat', {
    p_campionat: {
      nom: campionat.nom.trim(),
      data: campionat.data,
      temporada_codi: campionat.temporadaCodi,
      organitzador: campionat.organitzador.trim(),
      computa_barruf: campionat.computaBarruf,
      motiu_no_computa: campionat.computaBarruf ? null : campionat.motiuNoComputa.trim(),
      finalitzat: campionat.finalitzat,
      rondes_previstes: proposta.rondesPrevistes,
      rondes_jugades: proposta.rondesJugades,
      origen: proposta.origen,
    },
    p_participants: participants,
    p_partides: partidesPerDesar(proposta),
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/campionats')
  revalidatePath('/gestio')

  const resum = data as {
    campionat_id: string
    participants: number
    jugadors_nous: number
    partides: number
  }

  return {
    ok: true,
    campionatId: resum.campionat_id,
    participants: resum.participants,
    jugadorsNous: resum.jugadors_nous || altesNoves,
    partides: resum.partides,
  }
}

export type ResultatReimportacio =
  | { ok: true; participants: number; jugadorsNous: number; partides: number; partidesAnteriors: number }
  | { ok: false; error: string }

/**
 * Substitueix els participants i les partides d'un campionat ja desat pels del
 * fitxer. Les dades del campionat es conserven. El BARRUF no es mou fins que
 * es torni a publicar.
 */
export async function reimporta(
  campionatId: string,
  proposta: Proposta,
  decisions: Record<number, number | null>,
): Promise<ResultatReimportacio> {
  if (!(await gestorConnectat())) return { ok: false, error: 'Cal haver entrat com a gestor.' }

  const supabase = await clientServidor()
  const { data, error } = await supabase.rpc('reimporta_campionat', {
    p_campionat_id: campionatId,
    p_campionat: { rondes_jugades: proposta.rondesJugades, origen: proposta.origen },
    p_participants: participantsPerDesar(proposta, decisions),
    p_partides: partidesPerDesar(proposta),
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/campionats/${campionatId}`)
  revalidatePath(`/gestio/campionats/${campionatId}`)
  revalidatePath('/campionats')

  const resum = data as {
    participants: number
    jugadors_nous: number
    partides: number
    partides_anteriors: number
  }
  return {
    ok: true,
    participants: resum.participants,
    jugadorsNous: resum.jugadors_nous,
    partides: resum.partides,
    partidesAnteriors: resum.partides_anteriors,
  }
}
