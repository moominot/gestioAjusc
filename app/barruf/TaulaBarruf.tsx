'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { FletxaPosicio, FletxaPunts } from '../../components/Variacio'
import { normalitzaNom } from '../../lib/importacio/noms'
import type { FilaClassificacio } from '../../lib/supabase/tipus'

const decimal = (valor: number) =>
  valor.toLocaleString('ca-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function TaulaBarruf({ files, ambPosicio }: { files: FilaClassificacio[]; ambPosicio: boolean }) {
  const [text, setText] = useState('')
  const [club, setClub] = useState('tots')
  const [categoria, setCategoria] = useState('totes')
  const [nomesMoguts, setNomesMoguts] = useState(false)

  const clubs = useMemo(
    () => [...new Set(files.map((f) => f.club).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'ca')),
    [files],
  )
  const categories = useMemo(
    () => [...new Set(files.map((f) => f.categoria).filter((c): c is string => !!c))],
    [files],
  )

  const visibles = useMemo(() => {
    const trossos = normalitzaNom(text).split(' ').filter(Boolean)
    return files.filter((f) => {
      if (club === 'cap' ? f.club : club !== 'tots' && f.club !== club) return false
      if (categoria !== 'totes' && f.categoria !== categoria) return false
      if (nomesMoguts && f.partides_edicio === 0) return false
      const nom = normalitzaNom(f.nom_complet)
      return trossos.every((t) => nom.includes(t))
    })
  }, [files, text, club, categoria, nomesMoguts])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Cerca un jugador…"
          className="w-full max-w-xs rounded border border-stone-300 px-3 py-1.5 text-sm"
        />
        <select value={club} onChange={(e) => setClub(e.target.value)} className="rounded border border-stone-300 px-2 py-1.5 text-sm">
          <option value="tots">Tots els clubs</option>
          {clubs.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value="cap">Sense club</option>
        </select>
        {categories.length > 0 ? (
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded border border-stone-300 px-2 py-1.5 text-sm">
            <option value="totes">Totes les categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : null}
        <label className="flex items-center gap-1.5 text-sm text-stone-600">
          <input type="checkbox" checked={nomesMoguts} onChange={(e) => setNomesMoguts(e.target.checked)} />
          Només qui ha jugat
        </label>
        <span className="text-sm text-stone-500">{visibles.length} jugadors</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              {ambPosicio ? (
                <>
                  <th className="px-3 py-3 font-medium">Pos</th>
                  <th className="px-2 py-3 font-medium" title="Respecte de l'edició anterior">
                    Var
                  </th>
                </>
              ) : null}
              <th className="px-3 py-3 font-medium">Jugador</th>
              <th className="hidden px-3 py-3 font-medium sm:table-cell">Club</th>
              <th className="px-3 py-3 text-right font-medium">BARRUF</th>
              <th className="px-3 py-3 text-right font-medium" title="Progressió respecte de l'edició anterior">
                Prg
              </th>
              <th className="px-3 py-3 font-medium">Categoria</th>
              <th className="px-3 py-3 text-right font-medium" title="Victòries i partides al campionat barrufat">
                Campionat
              </th>
              <th className="px-3 py-3 text-right font-medium" title="Victòries i partides d'aquesta temporada">
                Temporada
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {visibles.map((f) => {
              const barruf = Math.round(Number(f.barruf))
              // Un BARRUF anterior a 0 (novells de l’arxiu) és el de sortida, 950.
              const prg = f.barruf_anterior === null ? null : barruf - (Math.round(Number(f.barruf_anterior)) || 950)
              return (
                <tr key={f.jugador_numero} className="hover:bg-stone-50">
                  {ambPosicio ? (
                    <>
                      <td className="xifres px-3 py-2 text-stone-500">{f.posicio ?? '—'}</td>
                      <td className="px-2 py-2">
                        {f.debutant && f.posicio_anterior === null ? (
                          <span className="text-xs font-medium text-sky-700">deb</span>
                        ) : (
                          <FletxaPosicio ara={f.posicio} abans={f.posicio_anterior} />
                        )}
                      </td>
                    </>
                  ) : null}
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/jugadors/${f.jugador_numero}`} className="hover:underline">
                      {f.nom_complet}
                    </Link>
                    {/* En un mòbil, el club va sota el nom i no en una columna. */}
                    {f.club ? <span className="block text-xs font-normal text-stone-500 sm:hidden">{f.club}</span> : null}
                  </td>
                  <td className="hidden px-3 py-2 text-stone-600 sm:table-cell">{f.club ?? '—'}</td>
                  <td className="xifres px-3 py-2 text-right font-semibold">{barruf}</td>
                  <td className="px-3 py-2 text-right">
                    <FletxaPunts valor={prg} />
                    {/* Canvi sense haver jugat: correcció de dades anteriors. */}
                    {prg !== null && prg !== 0 && f.partides_edicio === 0 ? (
                      <span
                        className="cursor-help text-amber-700"
                        title="No ha jugat en aquesta edició: el canvi és una correcció de dades anteriors (una fusió de duplicats, un resultat corregit) que, en recalcular la cadena, ha mogut lleugerament el seu BARRUF."
                      >
                        *
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-stone-600">{f.categoria ?? '—'}</td>
                  <td className="xifres px-3 py-2 text-right text-stone-600">
                    {f.partides_edicio > 0 ? `${decimal(Number(f.victories_edicio))} / ${f.partides_edicio}` : '—'}
                  </td>
                  <td className="xifres px-3 py-2 text-right text-stone-400">
                    {f.partides_temporada > 0
                      ? `${decimal(Number(f.victories_temporada))} / ${f.partides_temporada}`
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
