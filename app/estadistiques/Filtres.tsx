'use client'

import { usePathname, useRouter } from 'next/navigation'

import { CercaJugador, type JugadorCercable } from '../../components/CercaJugador'
import { ESTATS } from '../../lib/estadistiques/consultes'

export interface ValorsFiltres {
  des_de?: string
  fins_a?: string
  club?: string
  campionat?: string
  jugador?: number
  estat?: string
  minim?: number
}

const camp = 'rounded border border-stone-300 bg-white px-2 py-1.5 text-sm'

/** La barra de filtres: cada canvi va a l'adreça, i la pàgina es torna a calcular. */
export function Filtres({
  valors,
  temporades,
  clubs,
  campionats,
  registre,
  ambMinim,
  minimPerDefecte,
}: {
  valors: ValorsFiltres
  temporades: string[]
  clubs: string[]
  campionats: { id: string; nom: string; temporada: string }[]
  registre: JugadorCercable[]
  ambMinim: boolean
  minimPerDefecte?: number
}) {
  const router = useRouter()
  const ruta = usePathname()

  const canvia = (canvis: Partial<Record<keyof ValorsFiltres, string | number | undefined>>) => {
    const nous = { ...valors, ...canvis }
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(nous)) if (v !== undefined && v !== '') p.set(k, String(v))
    router.push(p.size ? `${ruta}?${p}` : ruta, { scroll: false })
  }

  const jugador = registre.find((j) => j.numero === valors.jugador)
  const perTemporada = temporades.map((t) => ({ t, llista: campionats.filter((c) => c.temporada === t) })).filter((g) => g.llista.length)
  const algun = Object.values(valors).some((v) => v !== undefined)

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white p-3 text-sm">
      <label className="flex items-center gap-1.5">
        <span className="text-stone-500">Des de</span>
        <select value={valors.des_de ?? ''} onChange={(e) => canvia({ des_de: e.target.value || undefined })} className={camp}>
          <option value="">2014-15</option>
          {[...temporades].reverse().map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-stone-500">fins a</span>
        <select value={valors.fins_a ?? ''} onChange={(e) => canvia({ fins_a: e.target.value || undefined })} className={camp}>
          <option value="">ara</option>
          {temporades.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <select value={valors.club ?? ''} onChange={(e) => canvia({ club: e.target.value || undefined })} className={camp}>
        <option value="">Tots els clubs</option>
        {clubs.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select
        value={valors.campionat ?? ''}
        onChange={(e) => canvia({ campionat: e.target.value || undefined })}
        className={`${camp} max-w-[16rem]`}
      >
        <option value="">Tots els campionats</option>
        {perTemporada.map((g) => (
          <optgroup key={g.t} label={g.t}>
            {g.llista.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </optgroup>
        ))}
      </select>
      <select value={valors.estat ?? ''} onChange={(e) => canvia({ estat: e.target.value || undefined })} className={camp}>
        <option value="">Tots els estats</option>
        {ESTATS.map((e) => <option key={e.clau} value={e.clau}>{e.text}</option>)}
      </select>
      {jugador ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-3 py-1">
          {jugador.nom}
          <button type="button" onClick={() => canvia({ jugador: undefined })} className="text-stone-400 hover:text-stone-900" aria-label="Treure el jugador">
            ×
          </button>
        </span>
      ) : (
        <CercaJugador registre={registre} placeholder="Un jugador…" onTria={(j) => canvia({ jugador: j.numero })} />
      )}
      {ambMinim ? (
        <label className="flex items-center gap-1.5">
          <span className="text-stone-500">mínim</span>
          <input
            type="number"
            min={1}
            defaultValue={valors.minim}
            placeholder={minimPerDefecte ? String(minimPerDefecte) : undefined}
            onBlur={(e) => canvia({ minim: e.target.value || undefined })}
            onKeyDown={(e) => e.key === 'Enter' && canvia({ minim: (e.target as HTMLInputElement).value || undefined })}
            className={`${camp} w-20`}
          />
          <span className="text-stone-500">partides</span>
        </label>
      ) : null}
      {algun ? (
        <button type="button" onClick={() => router.push(ruta, { scroll: false })} className="ml-auto text-stone-500 underline hover:text-stone-900">
          Treure els filtres
        </button>
      ) : null}
    </div>
  )
}
