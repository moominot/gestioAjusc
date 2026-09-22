'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'

import {
  analitza,
  desa,
  type DadesCampionat,
  type Proposta,
  type ResultatDesat,
} from './accions'

const avui = () => new Date().toISOString().slice(0, 10)

/** Temporada a què pertany una data: de setembre a agost. */
function temporadaDe(data: string): string {
  const dia = new Date(data)
  const any = dia.getUTCMonth() >= 8 ? dia.getUTCFullYear() : dia.getUTCFullYear() - 1
  return `${any}-${String((any + 1) % 100).padStart(2, '0')}`
}

const ETIQUETA_COM: Record<string, { text: string; classe: string }> = {
  exacte: { text: 'Trobat', classe: 'bg-emerald-100 text-emerald-800' },
  alies: { text: 'Per àlies', classe: 'bg-sky-100 text-sky-800' },
  dubtos: { text: 'Cal decidir', classe: 'bg-amber-100 text-amber-900' },
  nou: { text: 'Alta nova', classe: 'bg-stone-200 text-stone-700' },
}

export function Importador({ temporades }: { temporades: string[] }) {
  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [decisions, setDecisions] = useState<Record<number, number | null>>({})
  const [desat, setDesat] = useState<ResultatDesat | null>(null)
  const [treballant, comença] = useTransition()

  const [campionat, setCampionat] = useState<DadesCampionat>({
    nom: '',
    data: avui(),
    temporadaCodi: temporadaDe(avui()),
    organitzador: '',
    computaBarruf: true,
    motiuNoComputa: '',
    finalitzat: false,
  })

  function analitzaFitxers(dades: FormData) {
    setError(null)
    comença(async () => {
      const resultat = await analitza(dades)
      if (!resultat.ok) {
        setError(resultat.error)
        return
      }
      setProposta(resultat.proposta)
      setCampionat((actual) => ({
        ...actual,
        nom: resultat.proposta.nom || actual.nom,
        organitzador: resultat.proposta.organitzador || actual.organitzador,
      }))
    })
  }

  function desaCampionat() {
    if (!proposta) return
    setError(null)
    comença(async () => {
      const resultat = await desa(proposta, campionat, decisions)
      if (!resultat.ok) setError(resultat.error)
      else setDesat(resultat)
    })
  }

  const decisioDe = (participant: Proposta['participants'][number]) =>
    participant.localId in decisions ? decisions[participant.localId] : participant.jugadorNumero

  if (desat?.ok) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="font-semibold text-emerald-900">Campionat importat</h2>
        <p className="mt-2 text-sm text-emerald-900">
          {desat.participants} participants, {desat.partides} partides
          {desat.jugadorsNous > 0 ? `, ${desat.jugadorsNous} altes noves` : null}.
        </p>
        <p className="mt-3 text-sm text-emerald-900">
          {campionat.finalitzat && campionat.computaBarruf
            ? 'Com que està finalitzat i computa, ja pot entrar a la propera edició del BARRUF.'
            : 'Encara no entra a la cadena del BARRUF: un campionat es barrufa quan s’acaba.'}
        </p>
        <div className="mt-4 flex gap-3 text-sm">
          <Link href="/campionats" className="underline">
            Veure els campionats
          </Link>
          <button
            type="button"
            className="underline"
            onClick={() => {
              setProposta(null)
              setDesat(null)
              setDecisions({})
            }}
          >
            Importar-ne un altre
          </button>
        </div>
      </div>
    )
  }

  const pendents = proposta?.participants.filter((p) => decisioDe(p) === null).length ?? 0

  return (
    <div className="space-y-8">
      {error ? (
        <p className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {!proposta ? (
        <form action={analitzaFitxers} className="space-y-6">
          <fieldset className="rounded-lg border border-stone-200 bg-white p-5">
            <legend className="px-2 text-sm font-semibold">Des del SwissPerfect</legend>
            <p className="text-sm text-stone-600">
              Els fitxers del torneig. Porten els noms, totes les rondes i la puntuació de cada
              partida.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[
                ['trn', '.trn — participants', true],
                ['sco', '.sco — resultats', true],
                ['ini', '.ini — dades generals', false],
              ].map(([nom, text, cal]) => (
                <label key={nom as string} className="block text-sm">
                  <span className="font-medium">
                    {text as string}
                    {cal ? null : <span className="text-stone-400"> (opcional)</span>}
                  </span>
                  <input
                    type="file"
                    name={nom as string}
                    className="mt-1 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-stone-900 file:px-3 file:py-1.5 file:text-white"
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <div className="text-center text-sm text-stone-400">o bé</div>

          <fieldset className="rounded-lg border border-stone-200 bg-white p-5">
            <legend className="px-2 text-sm font-semibold">Des d’un full de càlcul o CSV</legend>
            <p className="text-sm text-stone-600">
              Amb les columnes <strong>Ronda</strong>, <strong>Jugador 1</strong>,{' '}
              <strong>Puntuació 1</strong>, <strong>Jugador 2</strong> i{' '}
              <strong>Puntuació 2</strong>. La puntuació tant pot ser la de la partida com el
              resultat en 1, 0,5 o 0. Per a un descans, deixeu l’adversari en blanc o poseu-hi
              BYE.
            </p>
            <label className="mt-4 block text-sm">
              <input
                type="file"
                name="full"
                accept=".xlsx,.xls,.csv,.tsv,.txt"
                className="mt-1 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-stone-900 file:px-3 file:py-1.5 file:text-white"
              />
            </label>
          </fieldset>

          <button
            type="submit"
            disabled={treballant}
            className="rounded-lg bg-stone-900 px-4 py-2 text-white hover:bg-stone-700 disabled:opacity-50"
          >
            {treballant ? 'Llegint…' : 'Llegir els fitxers'}
          </button>
        </form>
      ) : (
        <>
          <section className="rounded-lg border border-stone-200 bg-white p-5">
            <h2 className="font-semibold">Què s’ha llegit</h2>
            <p className="mt-1 text-sm text-stone-600">
              {proposta.participants.length} participants · {proposta.partides.length} partides ·{' '}
              {proposta.rondesJugades} rondes jugades
              {proposta.rondesPrevistes ? ` de ${proposta.rondesPrevistes} previstes` : null}
              {proposta.pestanya ? ` · pestanya «${proposta.pestanya}»` : null}
            </p>
            {proposta.rondesPendents.length > 0 ? (
              <p className="mt-2 text-sm text-amber-800">
                Rondes aparellades però no jugades: {proposta.rondesPendents.join(', ')}. No
                s’importen.
              </p>
            ) : null}
            {proposta.rondesDeduides ? (
              <p className="mt-2 text-sm text-amber-800">
                El full no portava columna de ronda: s’han repartit de manera que ningú no en
                repeteixi cap. Per al BARRUF és indiferent.
              </p>
            ) : null}
          </section>

          <section className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
            <h2 className="font-semibold">Dades del campionat</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium">Nom</span>
                <input
                  value={campionat.nom}
                  onChange={(e) => setCampionat({ ...campionat, nom: e.target.value })}
                  className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Organitzador</span>
                <input
                  value={campionat.organitzador}
                  onChange={(e) => setCampionat({ ...campionat, organitzador: e.target.value })}
                  className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Data</span>
                <input
                  type="date"
                  value={campionat.data}
                  onChange={(e) =>
                    setCampionat({
                      ...campionat,
                      data: e.target.value,
                      temporadaCodi: temporadaDe(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Temporada</span>
                <select
                  value={campionat.temporadaCodi}
                  onChange={(e) => setCampionat({ ...campionat, temporadaCodi: e.target.value })}
                  className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
                >
                  {temporades.map((codi) => (
                    <option key={codi} value={codi}>
                      {codi}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={campionat.computaBarruf}
                onChange={(e) => setCampionat({ ...campionat, computaBarruf: e.target.checked })}
                className="mt-1"
              />
              <span>
                <strong>Compta per al BARRUF.</strong> Desmarqueu-ho per a un campionat d’arxiu:
                es podrà consultar i donarà estadístiques, però no mourà cap puntuació.
              </span>
            </label>
            {!campionat.computaBarruf ? (
              <label className="block text-sm">
                <span className="font-medium">Per què no computa</span>
                <input
                  value={campionat.motiuNoComputa}
                  onChange={(e) => setCampionat({ ...campionat, motiuNoComputa: e.target.value })}
                  placeholder="Anterior al registre, no compleix les bases…"
                  className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
                />
              </label>
            ) : null}

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={campionat.finalitzat}
                onChange={(e) => setCampionat({ ...campionat, finalitzat: e.target.checked })}
                className="mt-1"
              />
              <span>
                <strong>El campionat s’ha acabat.</strong> Un campionat es barrufa quan acaba, mai
                per trams: fins que no ho marqueu, no entrarà a la cadena.
              </span>
            </label>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-200 px-5 py-4">
              <h2 className="font-semibold">Jugadors</h2>
              <p className="text-sm text-stone-600">
                {proposta.participants.filter((p) => p.com === 'exacte' || p.com === 'alies').length}{' '}
                trobats al registre ·{' '}
                {pendents > 0 ? (
                  <strong className="text-amber-800">{pendents} per decidir</strong>
                ) : (
                  'cap per decidir'
                )}
              </p>
            </div>
            <ul className="divide-y divide-stone-100">
              {proposta.participants.map((participant) => {
                const decisio = decisioDe(participant)
                const etiqueta = ETIQUETA_COM[participant.com]
                const resolt = participant.com === 'exacte' || participant.com === 'alies'

                return (
                  <li key={participant.localId} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="font-medium">{participant.nom}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${etiqueta.classe}`}>
                        {etiqueta.text}
                      </span>
                      <span className="text-xs text-stone-400">
                        {participant.partides} partides
                        {participant.puntuacioInicial
                          ? ` · puntuació al fitxer: ${participant.puntuacioInicial}`
                          : null}
                      </span>
                      <span className="flex-1" />
                      {resolt ? (
                        <span className="text-sm text-stone-500">núm. {decisio}</span>
                      ) : (
                        <select
                          value={decisio === null ? '' : String(decisio)}
                          onChange={(e) =>
                            setDecisions({
                              ...decisions,
                              [participant.localId]:
                                e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          className={`rounded border px-2 py-1 text-sm ${
                            decisio === null ? 'border-amber-400 bg-amber-50' : 'border-stone-300'
                          }`}
                        >
                          <option value="">Donar-lo d’alta com a jugador nou</option>
                          {participant.candidats.map((candidat) => (
                            <option key={candidat.numero} value={candidat.numero}>
                              {candidat.nom} (núm. {candidat.numero}, {candidat.semblanca} %
                              {candidat.corroborat ? ', mateixa puntuació' : ''})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    {participant.candidats.some((c) => c.corroborat) && decisio === null ? (
                      <p className="mt-1 text-xs text-amber-800">
                        Al registre només hi ha un jugador amb la puntuació {participant.puntuacioInicial}:{' '}
                        {participant.candidats.find((c) => c.corroborat)?.nom}. Probablement és el
                        mateix, però confirmeu-ho.
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </section>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={desaCampionat}
              disabled={treballant}
              className="rounded-lg bg-stone-900 px-4 py-2 text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {treballant ? 'Desant…' : 'Importar el campionat'}
            </button>
            <button
              type="button"
              onClick={() => {
                setProposta(null)
                setDecisions({})
              }}
              className="text-sm text-stone-500 underline hover:text-stone-900"
            >
              Tornar a començar
            </button>
            {pendents > 0 ? (
              <span className="text-sm text-stone-600">
                {pendents} jugadors entraran com a altes noves.
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
