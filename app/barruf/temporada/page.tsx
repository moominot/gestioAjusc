import Link from 'next/link'

import { Avis } from '../../../components/Avis'
import { destacats, type JugadorDestacat } from '../../../lib/informe/destacats'
import type { InformeCru } from '../../../lib/informe/model'
import { clientServidor } from '../../../lib/supabase/servidor'

export const metadata = { title: 'Resum de la temporada' }
export const revalidate = 300

const CATEGORIA = ['Gran Gran Mestre', 'Gran Mestre', 'Mestre', 'Expert', 'Avançat']

function Bloc({ titol, jugadors, nota }: { titol: string; jugadors: JugadorDestacat[]; nota?: string }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white">
      <h2 className="border-b border-stone-200 px-4 py-2 text-sm font-semibold">{titol}</h2>
      {jugadors.length === 0 ? (
        <p className="px-4 py-2 text-sm text-stone-500">Cap</p>
      ) : (
        <ol className="divide-y divide-stone-100 text-sm">
          {jugadors.map((j) => (
            <li key={j.numero} className="flex items-baseline justify-between gap-3 px-4 py-1.5">
              <span>
                <Link href={`/jugadors/${j.numero}`} className="font-medium hover:underline">
                  {j.nom}
                </Link>
                {j.club ? <span className="ml-2 text-xs text-stone-400">{j.club}</span> : null}
              </span>
              <span className="xifres whitespace-nowrap text-stone-700">{j.valor}</span>
            </li>
          ))}
        </ol>
      )}
      {nota ? <p className="px-4 py-2 text-xs text-stone-500">{nota}</p> : null}
    </section>
  )
}

export default async function ResumTemporada({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const { t } = await searchParams
  const temporada = t && /^\d{4}-\d{2}$/.test(t) ? t : null

  const supabase = await clientServidor()
  const { data, error } = await supabase.rpc('informe_temporada', { p_temporada: temporada })
  if (error) return <Avis titol="No s'ha pogut carregar el resum">{error.message}</Avis>
  if (!data) return <Avis titol="No hi ha dades d'aquesta temporada">Trieu-ne una altra.</Avis>

  const cru = data as InformeCru & { temporades: string[] }
  const d = destacats(cru)

  const xifres = [
    { etiqueta: 'Jugadors actius', valor: d.xifres.actius },
    { etiqueta: 'Han jugat la temporada', valor: d.xifres.ambPartides },
    { etiqueta: 'Partides jugades', valor: d.xifres.partides },
    { etiqueta: 'Campionats barrufats', valor: d.xifres.campionats },
    { etiqueta: 'Debutants', valor: d.xifres.debutants },
    { etiqueta: 'Tornen a ser actius', valor: d.xifres.recuperats },
  ].filter((x) => x.valor !== null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/barruf" className="text-sm text-stone-500 underline hover:text-stone-900">
            ← Classificació
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Temporada {d.temporada}</h1>
          <p className="mt-1 text-sm text-stone-500">
            Comparativa entre el BARRUF {d.anterior}, el darrer de la temporada anterior, i el BARRUF{' '}
            {d.numero}, el darrer d’aquesta.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {cru.temporades.slice(0, 8).map((codi) => (
            <Link
              key={codi}
              href={`/barruf/temporada?t=${codi}`}
              className={`rounded-full px-3 py-1 ${codi === d.temporada ? 'bg-stone-900 text-white' : 'border border-stone-300 hover:border-stone-500'}`}
            >
              {codi}
            </Link>
          ))}
          <a
            href={`/barruf/pdf?temporada=${d.temporada}`}
            className="rounded bg-stone-900 px-3 py-1 text-white hover:bg-stone-700"
          >
            PDF de l’especial
          </a>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-3 lg:grid-cols-6">
        {xifres.map((x) => (
          <div key={x.etiqueta} className="bg-white px-4 py-3">
            <dt className="text-xs uppercase tracking-wide text-stone-500">{x.etiqueta}</dt>
            <dd className="xifres mt-1 text-2xl font-semibold">{x.valor}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 md:grid-cols-2">
        <Bloc
          titol="El podi"
          jugadors={d.podi.ara.map((j, i) => ({ ...j, valor: `${i + 1}r · ${j.valor}` }))}
          nota={d.podi.abans.length ? `L’any passat: ${d.podi.abans.map((j) => j.nom).join(', ')}.` : undefined}
        />
        <Bloc
          titol="Pugen de categoria"
          jugadors={d.pujadesCategoria.map((j) => ({ ...j, valor: `a ${CATEGORIA[j.ara - 1]}` }))}
        />
        <Bloc titol="Qui més ha pujat" jugadors={d.mesPujada} />
        <Bloc titol="Qui més ha baixat" jugadors={d.mesBaixada} />
        <Bloc titol="Qui més posicions ha guanyat" jugadors={d.mesPosicions} />
        <Bloc titol="Millor percentatge" jugadors={d.millorPercentatge} nota="Amb 20 partides o més a la temporada." />
        <Bloc titol="Més partides" jugadors={d.mesPartides} />
        <Bloc titol="Més victòries" jugadors={d.mesVictories} />
        <Bloc titol={`Debutants (${d.debutants.length})`} jugadors={d.debutants} />
        <Bloc titol={`Tornen a ser actius (${d.recuperats.length})`} jugadors={d.recuperats} />
      </div>
    </div>
  )
}
