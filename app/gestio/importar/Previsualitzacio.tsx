'use client'

import { useMemo } from 'react'

import type { JugadorCercable } from '../../../components/CercaJugador'
import type { Proposta } from './accions'

interface FilaJugador {
  localId: number
  nomFitxer: string
  registre: string
  partides: number
  victories: number
  favor: number | null
  contra: number | null
  scrabbles: number | null
}

const decimal = (n: number) => n.toLocaleString('ca-ES', { maximumFractionDigits: 1 })

/**
 * Tot el que s'importarà, tal com quedarà: el campionat, cada jugador amb qui
 * serà al registre i el seu balanç, i totes les partides ronda per ronda.
 */
export function Previsualitzacio({
  proposta,
  decisioDe,
  registre,
  campionat,
}: {
  proposta: Proposta
  decisioDe: (p: Proposta['participants'][number]) => number | null
  registre: JugadorCercable[]
  campionat: { nom: string; data: string; temporada: string; estat: string } | null
}) {
  const perNumero = useMemo(() => new Map(registre.map((j) => [j.numero, j.nom])), [registre])
  const perLocal = useMemo(() => new Map(proposta.participants.map((p) => [p.localId, p])), [proposta])

  const nomRegistre = (localId: number) => {
    const p = perLocal.get(localId)
    if (!p) return `?${localId}`
    const n = decisioDe(p)
    return n === null ? `${p.nom} (alta nova)` : (perNumero.get(n) ?? `núm. ${n}`)
  }

  const jugadors: FilaJugador[] = useMemo(() => {
    const files = new Map<number, FilaJugador>(
      proposta.participants.map((p) => [
        p.localId,
        { localId: p.localId, nomFitxer: p.nom, registre: '', partides: 0, victories: 0, favor: null, contra: null, scrabbles: null },
      ]),
    )
    const suma = (a: number | null, b: number | null | undefined) =>
      b === null || b === undefined ? a : (a ?? 0) + b
    for (const g of proposta.partides) {
      if (g.local2 === null) continue
      const costats: [number, number, number | null, number | null, number | null | undefined][] = [
        [g.local1, g.resultat1, g.punts1, g.punts2, g.estadistiques?.jugador1.scrabbles],
        [g.local2, 1 - g.resultat1, g.punts2, g.punts1, g.estadistiques?.jugador2.scrabbles],
      ]
      for (const [local, res, favor, contra, scr] of costats) {
        const f = files.get(local)
        if (!f) continue
        f.partides++
        f.victories += res
        f.favor = suma(f.favor, favor)
        f.contra = suma(f.contra, contra)
        f.scrabbles = suma(f.scrabbles, scr)
      }
    }
    return [...files.values()].sort((a, b) => b.victories - a.victories || (b.favor ?? 0) - (b.contra ?? 0) - ((a.favor ?? 0) - (a.contra ?? 0)))
  }, [proposta])

  const rondes = useMemo(() => {
    const m = new Map<number, Proposta['partides']>()
    for (const g of proposta.partides) m.set(g.ronda, [...(m.get(g.ronda) ?? []), g])
    return [...m].sort((a, b) => a[0] - b[0])
  }, [proposta])

  const altes = proposta.participants.filter((p) => decisioDe(p) === null).length
  const ambPunts = proposta.partides.some((g) => g.punts1 !== null)
  const ambScrabbles = jugadors.some((j) => j.scrabbles !== null)
  const jugades = proposta.partides.filter((g) => g.local2 !== null).length

  return (
    <section className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
      <div>
        <h2 className="font-semibold">Què s’importarà</h2>
        <p className="mt-1 text-sm text-stone-600">
          Repasseu-ho abans de desar: és exactament el que quedarà a la base de dades.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        {campionat ? (
          <>
            <dt className="text-stone-500">Campionat</dt>
            <dd className="font-medium sm:col-span-3">{campionat.nom || '(sense nom)'}</dd>
            <dt className="text-stone-500">Data i temporada</dt>
            <dd className="sm:col-span-3">
              {campionat.data} · {campionat.temporada} · {campionat.estat}
            </dd>
          </>
        ) : null}
        <dt className="text-stone-500">Jugadors</dt>
        <dd className="sm:col-span-3">
          {proposta.participants.length}
          {altes > 0 ? ` (${altes} altes noves al registre)` : ' (tots ja són al registre)'}
        </dd>
        <dt className="text-stone-500">Partides</dt>
        <dd className="sm:col-span-3">
          {jugades} en {rondes.length} rondes
          {ambPunts ? ', amb puntuació' : ', només el resultat'}
          {proposta.ambEstadistiques > 0 ? `, ${proposta.ambEstadistiques} amb scrabbles o millors jugades` : ''}
        </dd>
      </dl>

      <details open>
        <summary className="cursor-pointer text-sm font-medium">Classificació que en resulta</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-2 py-1 font-medium">Al fitxer</th>
                <th className="px-2 py-1 font-medium">Al registre</th>
                <th className="px-2 py-1 text-right font-medium">P</th>
                <th className="px-2 py-1 text-right font-medium">V</th>
                {ambPunts ? (
                  <>
                    <th className="px-2 py-1 text-right font-medium">Punts</th>
                    <th className="px-2 py-1 text-right font-medium">Dif.</th>
                  </>
                ) : null}
                {ambScrabbles ? <th className="px-2 py-1 text-right font-medium">Scr.</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {jugadors.map((j) => {
                const registrat = nomRegistre(j.localId)
                return (
                  <tr key={j.localId}>
                    <td className="px-2 py-1">{j.nomFitxer}</td>
                    <td className={`px-2 py-1 ${registrat.endsWith('(alta nova)') ? 'text-amber-800' : registrat === j.nomFitxer ? 'text-stone-400' : 'font-medium'}`}>
                      {registrat === j.nomFitxer ? '=' : registrat}
                    </td>
                    <td className="xifres px-2 py-1 text-right">{j.partides}</td>
                    <td className="xifres px-2 py-1 text-right">{decimal(j.victories)}</td>
                    {ambPunts ? (
                      <>
                        <td className="xifres px-2 py-1 text-right">{j.favor ?? '—'}</td>
                        <td className="xifres px-2 py-1 text-right">
                          {j.favor === null || j.contra === null ? '—' : `${j.favor - j.contra > 0 ? '+' : ''}${j.favor - j.contra}`}
                        </td>
                      </>
                    ) : null}
                    {ambScrabbles ? <td className="xifres px-2 py-1 text-right">{j.scrabbles ?? '—'}</td> : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </details>

      <details>
        <summary className="cursor-pointer text-sm font-medium">Totes les partides, per ronda</summary>
        <div className="mt-2 space-y-3">
          {rondes.map(([ronda, partides]) => (
            <div key={ronda}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Ronda {ronda}</h3>
              <ul className="mt-1 divide-y divide-stone-100 text-sm">
                {partides.map((g, i) => {
                  const e = g.estadistiques
                  const detall = (s: NonNullable<typeof e>['jugador1'] | undefined) =>
                    s
                      ? [
                          s.scrabbles !== null ? `${s.scrabbles} scr.` : null,
                          s.mot ? `${s.mot}${s.puntsMot !== null ? ` ${s.puntsMot}` : ''}` : null,
                          s.motLletra ? `${s.motLletra}${s.puntsLletra !== null ? ` ${s.puntsLletra}` : ''}` : null,
                        ].filter(Boolean).join(' · ')
                      : ''
                  return (
                    <li key={i} className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-3 py-1">
                      <span className={`text-right ${g.resultat1 === 1 ? 'font-semibold' : ''}`}>
                        {nomRegistre(g.local1)}
                        {detall(e?.jugador1) ? <span className="block text-xs text-stone-400">{detall(e?.jugador1)}</span> : null}
                      </span>
                      <span className="xifres text-center text-stone-700">
                        {g.local2 === null
                          ? 'descansa'
                          : g.punts1 !== null && g.punts2 !== null
                            ? `${g.punts1} – ${g.punts2}`
                            : g.resultat1 === 0.5
                              ? '½ – ½'
                              : `${g.resultat1} – ${1 - g.resultat1}`}
                      </span>
                      <span className={g.local2 !== null && g.resultat1 === 0 ? 'font-semibold' : ''}>
                        {g.local2 === null ? '' : nomRegistre(g.local2)}
                        {detall(e?.jugador2) ? <span className="block text-xs text-stone-400">{detall(e?.jugador2)}</span> : null}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </section>
  )
}
