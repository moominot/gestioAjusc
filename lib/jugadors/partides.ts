/**
 * Les partides d'un jugador: filtre i estadístiques del que queda filtrat.
 */

import type { FilaEnfrontament } from '../supabase/tipus'

export interface FiltrePartides {
  /** Número del rival, o `null` per a tots. */
  rival: number | null
  temporada: string | null
  campionat: string | null
}

export function filtra(partides: FilaEnfrontament[], f: FiltrePartides): FilaEnfrontament[] {
  return partides.filter(
    (p) =>
      (f.rival === null || p.rival_numero === f.rival) &&
      (f.temporada === null || p.temporada_codi === f.temporada) &&
      (f.campionat === null || p.campionat_id === f.campionat),
  )
}

export interface Resum {
  partides: number
  victories: number
  empats: number
  derrotes: number
  /** Partides de campionats antics de les quals no se sap el resultat. */
  senseResultat: number
  /** Victòries (els empats compten mitja) sobre partides amb resultat, de 0 a 1. */
  percentatge: number | null
  ambPunts: number
  mitjanaFavor: number | null
  mitjanaContra: number | null
  millor: FilaEnfrontament | null
  victoriaMesAmplia: FilaEnfrontament | null
}

export function resumeix(partides: FilaEnfrontament[]): Resum {
  // Dels campionats antics no se sap qui va guanyar cada partida: compten com a
  // jugades, però no entren al balanç de victòries ni al percentatge.
  const conegudes = partides.filter((p) => p.resultat !== null)
  const r = (p: FilaEnfrontament) => Number(p.resultat)
  const victories = conegudes.filter((p) => r(p) === 1).length
  const empats = conegudes.filter((p) => r(p) === 0.5).length
  const ambPunts = partides.filter((p) => p.punts !== null && p.punts_rival !== null)

  let millor: FilaEnfrontament | null = null
  let victoriaMesAmplia: FilaEnfrontament | null = null
  for (const p of ambPunts) {
    if (!millor || p.punts! > millor.punts!) millor = p
    const marge = p.punts! - p.punts_rival!
    if (marge > 0 && (!victoriaMesAmplia || marge > victoriaMesAmplia.punts! - victoriaMesAmplia.punts_rival!)) {
      victoriaMesAmplia = p
    }
  }

  return {
    partides: partides.length,
    victories,
    empats,
    derrotes: conegudes.length - victories - empats,
    senseResultat: partides.length - conegudes.length,
    percentatge: conegudes.length ? (victories + empats / 2) / conegudes.length : null,
    ambPunts: ambPunts.length,
    mitjanaFavor: ambPunts.length ? ambPunts.reduce((s, p) => s + p.punts!, 0) / ambPunts.length : null,
    mitjanaContra: ambPunts.length ? ambPunts.reduce((s, p) => s + p.punts_rival!, 0) / ambPunts.length : null,
    millor,
    victoriaMesAmplia,
  }
}

export interface FilaRival {
  numero: number
  nom: string
  partides: number
  /** Partides amb resultat conegut: sobre aquestes es fa el percentatge. */
  ambResultat: number
  victories: number
  /** `null` si contra aquest rival no se'n coneix cap resultat. */
  percentatge: number | null
}

/** El balanç contra cada rival, dels més jugats als que menys. */
export function perRival(partides: FilaEnfrontament[]): FilaRival[] {
  const rivals = new Map<number, FilaRival>()
  for (const p of partides) {
    const fila =
      rivals.get(p.rival_numero) ??
      { numero: p.rival_numero, nom: p.rival, partides: 0, ambResultat: 0, victories: 0, percentatge: null }
    fila.partides += 1
    if (p.resultat !== null) {
      fila.ambResultat += 1
      fila.victories += Number(p.resultat)
    }
    rivals.set(p.rival_numero, fila)
  }
  return [...rivals.values()]
    .map((f) => ({ ...f, percentatge: f.ambResultat ? f.victories / f.ambResultat : null }))
    .sort((a, b) => b.partides - a.partides || a.nom.localeCompare(b.nom, 'ca'))
}
