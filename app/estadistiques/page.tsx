import Link from 'next/link'

import { Avis } from '../../components/Avis'
import { CONSULTES, textEstat } from '../../lib/estadistiques/consultes'
import { estadistica, salo } from '../../lib/estadistiques/cau'

export const metadata = { title: 'Estadístiques' }
export const revalidate = 3600

type Registre = Record<string, unknown> | null

const xifra = (v: unknown, d = 0) =>
  Number(v ?? 0).toLocaleString('ca-ES', { minimumFractionDigits: d, maximumFractionDigits: d })

/** Una fitxa del Saló de la fama. */
function Fitxa({
  titol,
  valor,
  unitat,
  r,
  detall,
  consulta,
}: {
  titol: string
  valor: string
  unitat?: string
  r: Registre
  detall?: React.ReactNode
  consulta?: string
}) {
  if (!r) return null
  return (
    <div className="flex flex-col rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{titol}</p>
      <p className="xifres mt-1 text-3xl font-semibold tracking-tight">
        {valor}
        {unitat ? <span className="ml-1 text-base font-normal text-stone-500">{unitat}</span> : null}
      </p>
      <p className="mt-1 font-medium">
        <Link href={`/jugadors/${r.numero}`} className="hover:underline">
          {String(r.nom)}
        </Link>
      </p>
      {detall ? <p className="mt-0.5 text-sm text-stone-600">{detall}</p> : null}
      {consulta ? (
        <Link href={`/estadistiques/${consulta}`} className="mt-auto pt-3 text-sm text-stone-500 hover:text-stone-900">
          Veure la llista →
        </Link>
      ) : null}
    </div>
  )
}

const Campionat = ({ r }: { r: Record<string, unknown> }) =>
  r.campionat_id ? (
    <Link href={`/campionats/${r.campionat_id}`} className="hover:underline">
      {String(r.campionat)}
    </Link>
  ) : (
    <>{String(r.campionat ?? '')}</>
  )

export default async function Estadistiques() {
  let s: Awaited<ReturnType<typeof salo>>
  let estats: Record<string, unknown>[]
  try {
    ;[s, estats] = await Promise.all([salo(), estadistica('estats', {}, 3)])
  } catch (e) {
    return <Avis titol="No s'han pogut carregar les estadístiques">{(e as Error).message}</Avis>
  }
  const { barruf_maxim, partides, victories, millor_jugada, millor_lletra, scrabbles, scrabbles_partida, punts_partida, enfrontament, campionats } = s

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Estadístiques</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          Tot l’historial del BARRUF des del 2014 en un sol lloc. Comenceu pel Saló de la fama, o obriu una consulta per
          filtrar per temporades, club, campionat o jugador, veure-ho en gràfic i baixar-ho en CSV.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Saló de la fama</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fitxa
            titol="BARRUF més alt"
            valor={xifra(barruf_maxim?.valor)}
            r={barruf_maxim}
            detall={barruf_maxim ? `Edició ${barruf_maxim.edicio} (${barruf_maxim.temporada})` : null}
            consulta="barruf"
          />
          <Fitxa
            titol="Més partides"
            valor={xifra(partides?.valor)}
            unitat="partides"
            r={partides}
            detall={
              partides
                ? `${xifra(partides.partides)} des del 2014-15, en ${xifra(partides.campionats)} campionats i ${xifra(partides.temporades)} temporades`
                : null
            }
            consulta="activitat"
          />
          <Fitxa
            titol="Millor % de victòries"
            valor={xifra(Number(victories?.valor ?? 0) * 100, 1)}
            unitat="%"
            r={victories}
            detall={victories ? `${xifra(victories.amb_resultat)} partides amb resultat (mínim 200)` : null}
            consulta="victories"
          />
          <Fitxa
            titol="Més campionats"
            valor={xifra(campionats?.valor)}
            unitat="campionats"
            r={campionats}
            consulta="activitat"
          />
          <Fitxa
            titol="Millor jugada"
            valor={xifra(millor_jugada?.valor)}
            unitat="punts"
            r={millor_jugada}
            detall={
              millor_jugada ? (
                <>
                  <span className="font-mono font-semibold">{String(millor_jugada.mot ?? '')}</span> · <Campionat r={millor_jugada} />
                </>
              ) : null
            }
            consulta="jugades"
          />
          <Fitxa
            titol="Millor jugada amb lletra especial"
            valor={xifra(millor_lletra?.valor)}
            unitat="punts"
            r={millor_lletra}
            detall={
              millor_lletra ? (
                <>
                  <span className="font-mono font-semibold">{String(millor_lletra.mot ?? '')}</span> · <Campionat r={millor_lletra} />
                </>
              ) : null
            }
            consulta="jugades"
          />
          <Fitxa
            titol="Més scrabbles"
            valor={xifra(scrabbles?.valor)}
            unitat="scrabbles"
            r={scrabbles}
            detall={scrabbles ? `${xifra(scrabbles.mitjana, 2)} per partida` : null}
            consulta="jugades"
          />
          <Fitxa
            titol="Més scrabbles en una partida"
            valor={xifra(scrabbles_partida?.valor)}
            r={scrabbles_partida}
            detall={scrabbles_partida ? <>contra {String(scrabbles_partida.rival)} · <Campionat r={scrabbles_partida} /></> : null}
          />
          <Fitxa
            titol="Més punts en una partida"
            valor={xifra(punts_partida?.valor)}
            unitat="punts"
            r={punts_partida}
            detall={punts_partida ? <>contra {String(punts_partida.rival)} · <Campionat r={punts_partida} /></> : null}
          />
          {enfrontament ? (
            <div className="flex flex-col rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Enfrontament més repetit</p>
              <p className="xifres mt-1 text-3xl font-semibold tracking-tight">
                {xifra(enfrontament.valor)}
                <span className="ml-1 text-base font-normal text-stone-500">partides</span>
              </p>
              <p className="mt-1 font-medium">
                <Link href={`/jugadors/${enfrontament.numero}`} className="hover:underline">{String(enfrontament.nom)}</Link>
                {' – '}
                <Link href={`/jugadors/${enfrontament.rival_numero}`} className="hover:underline">{String(enfrontament.rival)}</Link>
              </p>
              <p className="mt-0.5 text-sm text-stone-600">
                Balanç {xifra(enfrontament.victories, 1)} – {xifra(Number(enfrontament.amb_resultat) - Number(enfrontament.victories), 1)}
              </p>
              <Link href="/estadistiques/enfrontaments" className="mt-auto pt-3 text-sm text-stone-500 hover:text-stone-900">
                Veure la llista →
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">El registre, ara</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {estats.map((e) => (
            <Link
              key={String(e.estat)}
              href={`/estadistiques/estats?estat=${e.estat}`}
              className="rounded-lg border border-stone-200 bg-white p-4 transition hover:border-stone-400"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{textEstat(e.estat)}</p>
              <p className="xifres mt-1 text-3xl font-semibold tracking-tight">
                {xifra(e.valor)}
                <span className="ml-1 text-base font-normal text-stone-500">jugadors</span>
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {xifra(e.partides)} partides, {xifra(e.partides_mitjanes, 1)} per jugador · BARRUF mitjà {xifra(e.barruf_mitja)}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Consultes</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {CONSULTES.map((c) => (
            <Link
              key={c.slug}
              href={`/estadistiques/${c.slug}`}
              className="rounded-lg border border-stone-200 bg-white p-4 transition hover:border-stone-400"
            >
              <p className="font-semibold">{c.titol} →</p>
              <p className="mt-1 text-sm text-stone-600">{c.descripcio}</p>
            </Link>
          ))}
        </div>
      </section>

      <p className="max-w-2xl text-xs text-stone-500">
        El club de cada jugador és l’actual, no el que tenia quan va jugar. D’alguns campionats del 2014 al 2018 només
        se’n saben els aparellaments, no els resultats; i les jugades i els scrabbles només són dels campionats que els
        van registrar.
      </p>
    </div>
  )
}
