'use server'

import { revalidatePath } from 'next/cache'

import type { JugadorCercable } from '../../../components/CercaJugador'
import { llegeixCsv, llegeixFitxerDeResultats } from '../../../lib/importacio/fitxers'
import { construeixTorneigDeFull, interpretaFiles } from '../../../lib/importacio/fulls'
import { resolNoms, type JugadorRegistre, type Nivell } from '../../../lib/importacio/resolucio'
import { validaImportacio } from '../../../lib/api/importacio'
import {
  llegeixTorneig,
  type EstadistiquesPartida,
  type Torneig,
} from '../../../lib/importacio/torneig'
import { clientServidor, gestorConnectat } from '../../../lib/supabase/servidor'
import { invalidaEstadistiques } from '../../../lib/estadistiques/invalida'

export interface ParticipantProposat {
  localId: number
  nom: string
  puntuacioInicial: number | null
  partides: number
  /** Número del registre si s'ha resolt tot sol, o null si cal decidir-ho. */
  jugadorNumero: number | null
  /** Com s'ha resolt: exacte, alies, dubtos o nou. */
  com: 'exacte' | 'alies' | 'dubtos' | 'nou'
  candidats: { numero: number; nom: string; semblanca: number; nivell: Nivell; corroborat: boolean }[]
}

export interface PartidaProposada {
  ronda: number
  local1: number
  local2: number | null
  resultat1: number
  punts1: number | null
  punts2: number | null
  estadistiques: EstadistiquesPartida | null
  /** Dades lliures de la partida (enllaços, taula, comentaris...), si n'hi ha. */
  dades?: Record<string, unknown> | null
}

export interface Proposta {
  origen: 'swissperfect' | 'full' | 'api'
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
  /** Dades lliures del campionat, si n'hi ha. */
  dadesCampionat?: Record<string, unknown> | null
}

export type ResultatAnalisi =
  | { ok: true; proposta: Proposta; registre: JugadorCercable[] }
  | { ok: false; error: string }

async function bytes(fitxer: File): Promise<Uint8Array> {
  return new Uint8Array(await fitxer.arrayBuffer())
}

const teContingut = (fitxer: unknown): fitxer is File =>
  fitxer instanceof File && fitxer.size > 0

/** El que se sap de cada participant abans de mirar-lo contra el registre. */
export interface ParticipantAResoldre {
  localId: number
  nom: string
  puntuacioInicial: number | null
  partides: number
  /** El número del registre, si qui envia les dades ja el sap. */
  numero: number | null
}

/**
 * Mira els participants contra el registre (nom exacte, àlies, semblança) i
 * torna la proposta de cadascun, amb el registre sencer per triar-ne a mà.
 * No s'exporta: en un fitxer 'use server' seria una acció pública.
 */
async function resolParticipants(
  entrada: ParticipantAResoldre[],
): Promise<{ participants: ParticipantProposat[]; registre: JugadorCercable[] }> {
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
  // Els números fusionats també valen: porten al jugador on es van fusionar.
  const { data: fusionats } = await supabase.from('jugadors').select('numero, fusionat_a').not('fusionat_a', 'is', null)
  const perNumero = new Map(registre.map((j) => [j.numero, j]))
  for (const f of fusionats ?? []) {
    const bo = perId.get(f.fusionat_a as string)
    if (bo) perNumero.set(f.numero as number, bo)
  }

  const resolts = resolNoms(
    entrada.map((p) => ({
      origen: p,
      nom: p.nom,
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

  const participants: ParticipantProposat[] = resolts.map((resolt) => {
    const { resolucio } = resolt
    const resolt_ =
      resolucio.tipus === 'exacte' || resolucio.tipus === 'alies' ? resolucio.jugador : null
    // Si qui envia el campionat ja diu quin número del registre és, mana això.
    const donat = resolt.origen.numero !== null ? perNumero.get(resolt.origen.numero) : undefined
    if (donat) {
      return {
        localId: resolt.origen.localId,
        nom: resolt.nom,
        puntuacioInicial: resolt.origen.puntuacioInicial,
        partides: resolt.origen.partides,
        jugadorNumero: donat.numero,
        com: 'exacte' as const,
        candidats: [],
      }
    }

    return {
      localId: resolt.origen.localId,
      nom: resolt.nom,
      puntuacioInicial: resolt.origen.puntuacioInicial,
      partides: resolt.origen.partides,
      jugadorNumero: resolt_?.numero ?? null,
      com: resolucio.tipus,
      candidats:
        resolucio.tipus === 'dubtos' || resolucio.tipus === 'nou'
          ? resolucio.candidats.map((c) => ({
              numero: c.jugador.numero,
              nom: perId.get(c.jugador.id)?.nomComplet ?? c.jugador.nomComplet,
              semblanca: Math.round(c.semblanca * 100),
              nivell: c.nivell,
              corroborat: c.unicAmbAquestaPuntuacio,
            }))
          : [],
    }
  })

  return {
    participants,
    registre: (jugadors ?? []).map((j) => ({
      numero: j.numero as number,
      nom: j.nom_complet as string,
      club: (j.clubs as unknown as { nom: string } | null)?.nom ?? null,
    })),
  }
}

/** Llegeix els fitxers, resol els noms i torna una proposta per revisar. */
export async function analitza(dades: FormData): Promise<ResultatAnalisi> {
  if (!(await gestorConnectat())) return { ok: false, error: 'Cal haver entrat com a gestor.' }

  try {
    const trn = dades.get('trn')
    const sco = dades.get('sco')
    const ini = dades.get('ini')
    const full = dades.get('full')
    const text = dades.get('text')

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
    } else if (typeof text === 'string' && text.trim()) {
      const delFull = construeixTorneigDeFull(interpretaFiles(llegeixCsv(text)))
      torneig = delFull
      origen = 'full'
      rondesDeduides = delFull.rondesDeduides
      rondesPerBlocs = delFull.rondesPerBlocs
    } else {
      return {
        ok: false,
        error: 'Cal pujar els fitxers del SwissPerfect, un full de càlcul o enganxar-hi les dades.',
      }
    }

    const partidesPer = new Map<number, number>()
    for (const partida of torneig.partides) {
      for (const jugador of [partida.blancId, partida.negreId]) {
        partidesPer.set(jugador, (partidesPer.get(jugador) ?? 0) + 1)
      }
    }
    const { participants, registre } = await resolParticipants(
      torneig.participants.map((p) => ({
        localId: p.id,
        nom: p.nomComplet,
        puntuacioInicial: p.puntuacioInicial,
        partides: partidesPer.get(p.id) ?? 0,
        numero: null,
      })),
    )

    return {
      ok: true,
      // El registre sencer, per poder triar a mà un jugador que la resolució no ha proposat.
      registre,
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
      dades: p.dades ?? null,
    }
  })
}

export interface DadesCampionat {
  nom: string
  data: string
  temporadaCodi: string
  organitzador: string
  /** Nom curt del club organitzador. Si no existeix, es crea. */
  clubOrganitzador: string
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

  // El club organitzador: el de la llista, o un de nou.
  let clubOrganitzadorId: string | null = null
  const club = campionat.clubOrganitzador.trim().replace(/s+/g, ' ')
  if (club) {
    const { data: existent } = await supabase.from('clubs').select('id').ilike('nom', club).maybeSingle()
    if (existent) clubOrganitzadorId = existent.id as string
    else {
      const { data: nou, error } = await supabase.from('clubs').insert({ nom: club }).select('id').single()
      if (error) return { ok: false, error: error.message }
      clubOrganitzadorId = nou.id as string
    }
  }

  const { data, error } = await supabase.rpc('importa_campionat', {
    p_campionat: {
      nom: campionat.nom.trim(),
      data: campionat.data,
      temporada_codi: campionat.temporadaCodi,
      organitzador: campionat.organitzador.trim(),
      club_organitzador_id: clubOrganitzadorId,
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

  if (proposta.dadesCampionat) {
    await supabase
      .from('campionats')
      .update({ dades: proposta.dadesCampionat })
      .eq('id', (data as { campionat_id: string }).campionat_id)
  }

  revalidatePath('/campionats')
  revalidatePath('/gestio')
  invalidaEstadistiques()

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

  if (proposta.dadesCampionat) {
    await supabase.from('campionats').update({ dades: proposta.dadesCampionat }).eq('id', campionatId)
  }

  revalidatePath(`/campionats/${campionatId}`)
  revalidatePath(`/gestio/campionats/${campionatId}`)
  revalidatePath('/campionats')
  invalidaEstadistiques()

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

// --- Importacions rebudes d'altres aplicacions ----------------------------------

export interface Rebuda {
  id: string
  connexio: string
  idExtern: string
  versio: number
  estat: 'pendent' | 'importada' | 'descartada'
  campionatId: string | null
  /** Les dades del campionat, per omplir el formulari. */
  campionat: Pick<DadesCampionat, 'nom' | 'data' | 'organitzador' | 'clubOrganitzador' | 'finalitzat'>
}

export type ResultatRebuda =
  | { ok: true; rebuda: Rebuda; proposta: Proposta; registre: JugadorCercable[] }
  | { ok: false; error: string }

/** Una importació rebuda, convertida en la proposta de l'importador. */
export async function analitzaRebuda(id: string): Promise<ResultatRebuda> {
  if (!(await gestorConnectat())) return { ok: false, error: 'Cal haver entrat com a gestor.' }

  const supabase = await clientServidor()
  const { data: fila, error } = await supabase
    .from('importacions_rebudes')
    .select('id, id_extern, versio, estat, campionat_id, dades, connexions(nom)')
    .eq('id', id)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!fila) return { ok: false, error: 'Aquesta importació no existeix.' }

  const validacio = validaImportacio(fila.dades)
  if (!validacio.ok) return { ok: false, error: `Les dades rebudes no són vàlides: ${validacio.errors.join('; ')}` }
  const { campionat, participants, partides } = validacio.importacio

  const local = new Map(participants.map((p, i) => [p.id, i + 1]))
  const partidesPer = new Map<number, number>()
  for (const p of partides) {
    for (const j of [p.jugador_1, p.jugador_2]) {
      if (j) partidesPer.set(local.get(j)!, (partidesPer.get(local.get(j)!) ?? 0) + 1)
    }
  }
  const { participants: resolts, registre } = await resolParticipants(
    participants.map((p, i) => ({
      localId: i + 1,
      nom: p.nom,
      puntuacioInicial: null,
      partides: partidesPer.get(i + 1) ?? 0,
      numero: p.numero,
    })),
  )

  const estadistiques = (p: (typeof partides)[number]): EstadistiquesPartida | null => {
    const e = {
      jugador1: { scrabbles: p.scrabbles_1, mot: p.mot_1, puntsMot: p.punts_mot_1, motLletra: p.mot_lletra_1, puntsLletra: p.punts_lletra_1 },
      jugador2: { scrabbles: p.scrabbles_2, mot: p.mot_2, puntsMot: p.punts_mot_2, motLletra: p.mot_lletra_2, puntsLletra: p.punts_lletra_2 },
    }
    return [...Object.values(e.jugador1), ...Object.values(e.jugador2)].some((v) => v !== null) ? e : null
  }
  const rondes = [...new Set(partides.map((p) => p.ronda))]

  return {
    ok: true,
    registre,
    rebuda: {
      id: fila.id as string,
      connexio: (fila.connexions as unknown as { nom: string } | null)?.nom ?? '',
      idExtern: fila.id_extern as string,
      versio: fila.versio as number,
      estat: fila.estat as Rebuda['estat'],
      campionatId: (fila.campionat_id as string | null) ?? null,
      campionat: {
        nom: campionat.nom,
        data: campionat.data,
        organitzador: campionat.organitzador ?? '',
        clubOrganitzador: campionat.club_organitzador ?? '',
        finalitzat: campionat.acabat,
      },
    },
    proposta: {
      origen: 'api',
      nom: campionat.nom,
      organitzador: campionat.organitzador ?? '',
      rondesPrevistes: campionat.rondes_previstes,
      rondesJugades: rondes.length,
      rondesPendents: [],
      pestanya: null,
      rondesDeduides: false,
      rondesPerBlocs: false,
      ambEstadistiques: partides.filter((p) => estadistiques(p)).length,
      participants: resolts,
      partides: partides.map((p) => ({
        ronda: p.ronda,
        local1: local.get(p.jugador_1)!,
        local2: p.jugador_2 === null ? null : local.get(p.jugador_2)!,
        // Sense resultat només hi pot haver els descansos, que compten com a victòria.
        resultat1: p.resultat_1 ?? 1,
        punts1: p.punts_1,
        punts2: p.punts_2,
        estadistiques: estadistiques(p),
        dades: p.dades,
      })),
      dadesCampionat: campionat.dades,
    },
  }
}

/** Després de revisar-la: importada (i lligada al campionat, per a les versions següents) o descartada. */
export async function marcaRebuda(id: string, campionatId: string | null, estat: 'importada' | 'descartada') {
  if (!(await gestorConnectat())) return { ok: false as const, error: 'Cal haver entrat com a gestor.' }
  const supabase = await clientServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('importacions_rebudes')
    .update({
      estat,
      revisada_el: new Date().toISOString(),
      revisada_per: user?.id ?? null,
      ...(campionatId ? { campionat_id: campionatId } : {}),
    })
    .eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/gestio/importacions')
  revalidatePath('/gestio')
  return { ok: true as const }
}
