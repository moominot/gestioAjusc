import Link from 'next/link'
import { notFound } from 'next/navigation'

import { categoria } from '../../../lib/informe/model'
import { clientServidor } from '../../../lib/supabase/servidor'

export const revalidate = 300

interface Membre {
  numero: number
  nom: string
  barruf: number | null
  estat: 'act' | 'exp' | 'inact' | 'nov' | null
  posicio: number | null
  partides_totals: number | null
  victories_totals: number | null
  partides_temporada: number | null
  victories_temporada: number | null
  darrera_temporada: string | null
}

interface FitxaClub {
  club: { nom: string; nom_llegenda: string | null }
  edicio: { numero: number; temporada: string }
  membres: Membre[]
  organitzats: {
    id: string
    nom: string
    data: string
    temporada: string
    primera_edicio: number | null
    participants: number
    partides: number
  }[]
  campionats_membres: { id: string; nom: string; data: string; temporada: string; membres: number }[]
  temporades: {
    temporada: string
    jugadors: number
    partides: number
    victories: number | null
    amb_resultat: number
    campionats: number
  }[]
  contra_clubs: { club: string; partides: number; victories: number }[]
}

const CATEGORIA = ['Gran Gran Mestre', 'Gran Mestre', 'Mestre', 'Expert', 'Avançat']
const ESTAT = { act: 'Actius', exp: 'En expectativa', inact: 'Inactius', nov: 'Sense partides' } as const

const enter = (n: number) => n.toLocaleString('ca-ES')
const pct = (v: number, de: number) => (de ? `${Math.round((v / de) * 100)}%` : '—')
const decimal = (n: number) => n.toLocaleString('ca-ES', { maximumFractionDigits: 1 })

async function carrega(nom: string): Promise<FitxaClub | null> {
  const supabase = await clientServidor()
  const { data } = await supabase.rpc('fitxa_club', { p_nom: nom })
  return (data as FitxaClub | null) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ nom: string }> }) {
  return { title: decodeURIComponent((await params).nom) }
}

function Tessela({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-stone-500">{etiqueta}</dt>
      <dd className="xifres mt-1 text-2xl font-semibold">{valor}</dd>
      {nota ? <dd className="text-xs text-stone-500">{nota}</dd> : null}
    </div>
  )
}

export default async function Club({ params }: { params: Promise<{ nom: string }> }) {
  const fitxa = await carrega(decodeURIComponent((await params).nom))
  if (!fitxa) notFound()

  const { club, edicio, membres, organitzats, campionats_membres, temporades, contra_clubs } = fitxa
  const actius = membres.filter((m) => m.estat === 'act')
  const mitjana = actius.length ? Math.round(actius.reduce((s, m) => s + Number(m.barruf), 0) / actius.length) : null
  const pt = membres.reduce((s, m) => s + (m.partides_totals ?? 0), 0)
  const vt = membres.reduce((s, m) => s + Number(m.victories_totals ?? 0), 0)
  const ptemp = membres.reduce((s, m) => s + (m.partides_temporada ?? 0), 0)
  const vtemp = membres.reduce((s, m) => s + Number(m.victories_temporada ?? 0), 0)
  const hanJugat = membres.filter((m) => (m.partides_temporada ?? 0) > 0).length
  const perCategoria = CATEGORIA.map((nom, i) => ({
    nom,
    n: actius.filter((m) => categoria(Number(m.barruf)) === i + 1).length,
  })).filter((c) => c.n > 0)
  const grups = (['act', 'exp', 'inact', 'nov'] as const)
    .map((e) => ({ estat: e, llista: membres.filter((m) => (m.estat ?? 'nov') === e) }))
    .filter((g) => g.llista.length > 0)

  return (
    <div className="space-y-8">
      <div>
        <Link href="/clubs" className="text-sm text-stone-500 underline hover:text-stone-900">
          ← Clubs
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{club.nom}</h1>
        {club.nom_llegenda ? <p className="mt-1 text-sm text-stone-600">{club.nom_llegenda}</p> : null}
        <p className="mt-1 text-xs text-stone-500">
          Segons el BARRUF {edicio.numero} (temporada {edicio.temporada}). Els membres són els jugadors que
          hi consten ara; les xifres històriques són les d’aquests membres.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-3 lg:grid-cols-6">
        <Tessela etiqueta="Membres" valor={enter(membres.length)} />
        <Tessela etiqueta="Actius" valor={enter(actius.length)} />
        <Tessela etiqueta="BARRUF mitjà" valor={mitjana === null ? '—' : String(mitjana)} nota="dels actius" />
        <Tessela etiqueta="Partides" valor={enter(pt)} nota={`${pct(vt, pt)} de victòries`} />
        <Tessela etiqueta={`Temp. ${edicio.temporada}`} valor={enter(ptemp)} nota={`partides, ${hanJugat} jugadors`} />
        <Tessela etiqueta="Organitza" valor={enter(organitzats.length)} nota="campionats" />
      </dl>

      {perCategoria.length > 0 ? (
        <p className="text-sm text-stone-600">
          <span className="text-stone-500">Actius per categoria:</span>{' '}
          {perCategoria.map((c) => `${c.n} ${c.nom}`).join(' · ')}
          {` · % de victòries aquesta temporada: ${pct(vtemp, ptemp)}`}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Membres</h2>
        {grups.map((g) => (
          <details key={g.estat} open={g.estat === 'act'} className="rounded-lg border border-stone-200 bg-white">
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
              {ESTAT[g.estat]} <span className="font-normal text-stone-400">· {g.llista.length}</span>
            </summary>
            <div className="overflow-x-auto border-t border-stone-100">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-1.5 font-medium">#</th>
                    <th className="px-4 py-1.5 font-medium">Jugador</th>
                    <th className="px-4 py-1.5 text-right font-medium">BARRUF</th>
                    <th className="px-4 py-1.5 text-right font-medium">Ptemp</th>
                    <th className="px-4 py-1.5 text-right font-medium">%temp</th>
                    <th className="px-4 py-1.5 text-right font-medium">PT</th>
                    <th className="px-4 py-1.5 text-right font-medium">%T</th>
                    <th className="px-4 py-1.5 font-medium">Darrera temporada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {g.llista.map((m) => (
                    <tr key={m.numero} className="hover:bg-stone-50">
                      <td className="xifres px-4 py-1.5 text-stone-400">{m.posicio ?? ''}</td>
                      <td className="px-4 py-1.5">
                        <Link href={`/jugadors/${m.numero}`} className="font-medium hover:underline">
                          {m.nom}
                        </Link>
                      </td>
                      <td className="xifres px-4 py-1.5 text-right font-semibold">
                        {m.barruf === null ? '—' : Math.round(Number(m.barruf))}
                      </td>
                      <td className="xifres px-4 py-1.5 text-right">{m.partides_temporada || '—'}</td>
                      <td className="xifres px-4 py-1.5 text-right text-stone-600">
                        {m.partides_temporada ? pct(Number(m.victories_temporada), m.partides_temporada) : '—'}
                      </td>
                      <td className="xifres px-4 py-1.5 text-right">{m.partides_totals ?? '—'}</td>
                      <td className="xifres px-4 py-1.5 text-right text-stone-600">
                        {m.partides_totals ? pct(Number(m.victories_totals), m.partides_totals) : '—'}
                      </td>
                      <td className="px-4 py-1.5 text-stone-500">{m.darrera_temporada ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </section>

      {temporades.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Per temporada</h2>
          <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-1.5 font-medium">Temporada</th>
                  <th className="px-4 py-1.5 text-right font-medium">Jugadors</th>
                  <th className="px-4 py-1.5 text-right font-medium">Campionats</th>
                  <th className="px-4 py-1.5 text-right font-medium">Partides</th>
                  <th className="px-4 py-1.5 text-right font-medium">% victòries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {temporades.map((t) => (
                  <tr key={t.temporada}>
                    <td className="px-4 py-1.5">{t.temporada}</td>
                    <td className="xifres px-4 py-1.5 text-right">{t.jugadors}</td>
                    <td className="xifres px-4 py-1.5 text-right">{t.campionats}</td>
                    <td className="xifres px-4 py-1.5 text-right">{enter(t.partides)}</td>
                    <td className="xifres px-4 py-1.5 text-right text-stone-600">
                      {t.amb_resultat ? pct(Number(t.victories ?? 0), t.amb_resultat) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {contra_clubs.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Contra els altres clubs</h2>
          <p className="text-sm text-stone-600">
            Partides dels membres contra jugadors d’altres clubs, en les que se sap el resultat.
          </p>
          <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {contra_clubs.map((c) => (
              <li key={c.club} className="flex items-baseline justify-between rounded-lg border border-stone-200 bg-white px-4 py-2">
                <Link href={`/clubs/${encodeURIComponent(c.club)}`} className="font-medium hover:underline">
                  {c.club}
                </Link>
                <span className="xifres text-stone-600">
                  {decimal(Number(c.victories))} de {c.partides}{' '}
                  <span className="text-stone-400">({pct(Number(c.victories), c.partides)})</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Campionats que organitza</h2>
          {organitzats.length === 0 ? (
            <p className="text-sm text-stone-500">Cap de registrat.</p>
          ) : (
            <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white text-sm">
              {organitzats.map((k) => (
                <li key={k.id} className="px-4 py-2">
                  <Link href={`/campionats/${k.id}`} className="font-medium hover:underline">
                    {k.nom}
                  </Link>
                  <span className="block text-xs text-stone-500">
                    {k.temporada} · {k.participants} jugadors · {k.partides} partides
                    {k.primera_edicio ? ` · BARRUF ${k.primera_edicio}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">On han jugat més membres</h2>
          {campionats_membres.length === 0 ? (
            <p className="text-sm text-stone-500">Cap.</p>
          ) : (
            <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white text-sm">
              {campionats_membres.map((k) => (
                <li key={k.id} className="flex items-baseline justify-between gap-3 px-4 py-2">
                  <span>
                    <Link href={`/campionats/${k.id}`} className="font-medium hover:underline">
                      {k.nom}
                    </Link>
                    <span className="ml-2 text-xs text-stone-500">{k.temporada}</span>
                  </span>
                  <span className="xifres whitespace-nowrap text-stone-600">{k.membres} membres</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
