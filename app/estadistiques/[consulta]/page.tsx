import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Avis } from '../../../components/Avis'
import { Barres, Linies, Nuvol } from '../../../components/Grafics'
import { consulta as troba, llegeixFiltres, perBaseDeDades, textEstat, type Bloc, type Fila } from '../../../lib/estadistiques/consultes'
import { estadistica, opcionsFiltres } from '../../../lib/estadistiques/cau'
import { Filtres } from '../Filtres'

type Parametres = Record<string, string | string[] | undefined>

export async function generateMetadata({ params }: { params: Promise<{ consulta: string }> }) {
  const c = troba((await params).consulta)
  return { title: c ? `${c.titol} · Estadístiques` : 'Estadístiques' }
}

/** Els actius no porten marca: només es marquen els inactius i els que són en expectativa. */
function MarcaEstat({ estat }: { estat?: string }) {
  if (!estat || estat === 'act') return null
  return (
    <span
      className={`ml-1.5 rounded px-1 py-px text-[0.7rem] ${estat === 'exp' ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-500'}`}
      title={textEstat(estat)}
    >
      {estat === 'exp' ? 'exp' : 'inactiu'}
    </span>
  )
}

/** Un bloc: gràfic dels primers i la taula sencera. */
function Taula({ bloc, files, estats }: { bloc: Bloc; files: Fila[]; estats: Map<number, string> }) {
  if (files.length === 0) return <p className="text-sm text-stone-500">No hi ha dades amb aquests filtres.</p>
  return (
    <div className="space-y-4">
      {bloc.nuvol ? (
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <Nuvol
            punts={files.map((f) => ({
              x: bloc.nuvol!.x(f),
              y: bloc.nuvol!.y(f),
              nom: String(f.nom),
              enllac: f.numero ? `/jugadors/${f.numero}` : null,
            }))}
            etiquetaX={bloc.nuvol.etiquetaX}
            etiquetaY={bloc.nuvol.etiquetaY}
            formatY={bloc.nuvol.formatY}
          />
        </div>
      ) : null}
      {bloc.barres ? (
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <Barres
            dades={files.slice(0, 20).map((f) => ({
              etiqueta: bloc.barres!.etiqueta(f),
              valor: bloc.barres!.valor(f),
              enllac: f.numero ? `/jugadors/${f.numero}` : null,
            }))}
            format={bloc.barres.format}
          />
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 text-left text-xs text-stone-500">
            <tr>
              <th className="px-3 py-2 text-right font-medium">#</th>
              {bloc.columnes.map((c) => (
                <th
                  key={c.etiqueta}
                  className={`px-3 py-2 font-medium ${c.dreta ? 'text-right' : ''} ${c.secundaria ? 'hidden sm:table-cell' : ''}`}
                >
                  {c.etiqueta}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {files.map((f, i) => (
              <tr key={i} className="border-b border-stone-100 last:border-0">
                <td className="xifres px-3 py-1.5 text-right text-stone-400">{i + 1}</td>
                {bloc.columnes.map((c) => {
                  const enllac = c.enllac?.(f)
                  return (
                    <td
                      key={c.etiqueta}
                      className={`px-3 py-1.5 ${c.dreta ? 'xifres text-right' : ''} ${c.secundaria ? 'hidden sm:table-cell' : ''}`}
                    >
                      {enllac ? (
                        <Link href={enllac} className="hover:underline">
                          {c.text(f)}
                        </Link>
                      ) : (
                        c.text(f)
                      )}
                      {c.etiqueta === 'Jugador' ? <MarcaEstat estat={estats.get(Number(f.numero))} /> : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default async function Consulta({
  params,
  searchParams,
}: {
  params: Promise<{ consulta: string }>
  searchParams: Promise<Parametres>
}) {
  const c = troba((await params).consulta)
  if (!c) notFound()
  const parametres = await searchParams
  const filtres = llegeixFiltres(parametres, c.minim)
  const bd = perBaseDeDades(filtres)

  let opcions: Awaited<ReturnType<typeof opcionsFiltres>>
  let resultats: Fila[][]
  let temporades: Fila[] = []
  try {
    ;[opcions, resultats, temporades] = await Promise.all([
      opcionsFiltres(),
      Promise.all(c.blocs.map((b) => estadistica(b.metrica, bd, b.limit))),
      c.perTemporada ? estadistica('temporades', bd, 100) : Promise.resolve([]),
    ])
  } catch (e) {
    return <Avis titol="No s'ha pogut fer la consulta">{(e as Error).message}</Avis>
  }

  const estats = new Map(opcions.registre.map((j) => [j.numero, j.estat]))

  // Els mateixos filtres per a la baixada en CSV.
  const query = new URLSearchParams(Object.entries(parametres).filter(([, v]) => typeof v === 'string') as [string, string][])
  const csv = (i: number) => `/estadistiques/${c.slug}/csv?${query.size ? `${query}&` : ''}bloc=${i}`

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm">
          <Link href="/estadistiques" className="text-stone-500 hover:text-stone-900">
            ← Estadístiques
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{c.titol}</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">{c.descripcio}</p>
      </div>

      <Filtres
        key={JSON.stringify(filtres)}
        valors={{ ...filtres, minim: parametres.minim ? filtres.minim : undefined }}
        temporades={opcions.temporades}
        clubs={opcions.clubs}
        campionats={opcions.campionats}
        registre={opcions.registre}
        ambMinim={c.minim !== undefined}
        minimPerDefecte={c.minim}
      />

      {c.perTemporada && temporades.length ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Temporada a temporada</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-stone-200 bg-white p-3">
              <p className="mb-1 text-sm font-medium">Jugadors</p>
              <Linies
                etiquetes={temporades.map((t) => String(t.temporada))}
                series={[
                  { nom: 'Jugadors', valors: temporades.map((t) => Number(t.jugadors)) },
                  { nom: 'Debutants', valors: temporades.map((t) => Number(t.debutants)) },
                  { nom: 'Comiats (darrera temporada dels que ara són inactius)', valors: temporades.map((t) => Number(t.comiats ?? 0)) },
                ]}
              />
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-3">
              <p className="mb-1 text-sm font-medium">Partides i campionats</p>
              <Linies
                etiquetes={temporades.map((t) => String(t.temporada))}
                series={[{ nom: 'Partides', valors: temporades.map((t) => Number(t.partides)) }]}
              />
              <Linies
                etiquetes={temporades.map((t) => String(t.temporada))}
                series={[{ nom: 'Campionats', valors: temporades.map((t) => Number(t.campionats)) }]}
                color={3}
                alt={130}
              />
            </div>
          </div>
        </section>
      ) : null}

      {c.blocs.map((b, i) =>
        // Amb un estat triat, la llista d'un altre estat sobra.
        (b.metrica === 'inactius' && filtres.estat && filtres.estat !== 'inact') ||
        (b.metrica === 'expectativa' && filtres.estat && filtres.estat !== 'exp') ? null : (
          <section key={b.metrica}>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold">{b.titol ?? 'Classificació'}</h2>
            {resultats[i].length ? (
              <a href={csv(i)} className="text-sm text-stone-500 hover:text-stone-900">
                Baixar en CSV
              </a>
            ) : null}
          </div>
          <Taula bloc={b} files={resultats[i]} estats={estats} />
          </section>
        ),
      )}
    </div>
  )
}
