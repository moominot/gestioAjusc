'use server'

import { revalidatePath } from 'next/cache'

import { llegeixFitxerDeResultats } from '../../../lib/importacio/fitxers'
import { construeixTorneigDeFull } from '../../../lib/importacio/fulls'
import { resolNoms, type JugadorRegistre } from '../../../lib/importacio/resolucio'
import { llegeixTorneig, type Torneig } from '../../../lib/importacio/torneig'
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
  participants: ParticipantProposat[]
  partides: PartidaProposada[]
}

export type ResultatAnalisi = { ok: true; proposta: Proposta } | { ok: false; error: string }

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
    } else {
      return { ok: false, error: 'Cal pujar els fitxers del SwissPerfect o bé un full de càlcul.' }
    }

    // Registre contra el qual resoldre els noms.
    const supabase = await clientServidor()
    const [{ data: jugadors }, { data: alies }] = await Promise.all([
      supabase.from('jugadors').select('id, numero, nom_complet').is('fusionat_a', null),
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
      proposta: {
        origen,
        nom: torneig.info?.nom ?? '',
        organitzador: torneig.info?.organitzador ?? '',
        rondesPrevistes: torneig.info?.rondesPrevistes ?? null,
        rondesJugades: torneig.rondesJugades.length,
        rondesPendents: torneig.rondesPendents,
        pestanya,
        rondesDeduides,
        participants,
        partides: torneig.partides.map((p) => ({
          ronda: p.ronda,
          local1: p.blancId,
          local2: p.negreId,
          resultat1: p.resultatBlanc,
          punts1: p.puntsBlanc,
          punts2: p.puntsNegre,
        })),
      },
    }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
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

  const participants = proposta.participants.map((participant) => ({
    local_id: String(participant.localId),
    nom: participant.nom,
    jugador_numero:
      participant.localId in decisions
        ? decisions[participant.localId]
        : participant.jugadorNumero,
  }))

  const senseDecidir = participants.filter((p) => p.jugador_numero === null)
  const altesNoves = senseDecidir.length

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
    p_partides: proposta.partides.map((p) => ({
      ronda: p.ronda,
      local_1: String(p.local1),
      local_2: p.local2 === null ? null : String(p.local2),
      resultat_1: p.resultat1,
      punts_1: p.punts1,
      punts_2: p.punts2,
    })),
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
