'use client'

import { useMemo, useState, useTransition } from 'react'

import { filtraJugadors } from '../../../components/CercaJugador'
import { editaJugador } from './accions'

export interface JugadorEditable {
  numero: number
  nom: string
  club: string | null
  barruf: number | null
  estat: string | null
}

export function EditorJugadors({ jugadors, clubs }: { jugadors: JugadorEditable[]; clubs: string[] }) {
  const [llista, setLlista] = useState(jugadors)
  const [text, setText] = useState('')
  const [editant, setEditant] = useState<number | null>(null)

  const trobats = useMemo(
    () => (text.trim() ? filtraJugadors(llista, text, 50) : []),
    [llista, text],
  )

  return (
    <div className="space-y-4">
      <input
        type="search"
        autoFocus
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setEditant(null)
        }}
        placeholder="Nom o número del jugador…"
        className="w-full max-w-md rounded border border-stone-300 px-3 py-2"
      />

      {/* Els clubs que ja existeixen, com a suggeriments per al camp del club. */}
      <datalist id="clubs">
        {clubs.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {text.trim() && trobats.length === 0 ? (
        <p className="text-sm text-stone-500">Cap jugador coincideix amb «{text}».</p>
      ) : null}

      {trobats.length > 0 ? (
        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
          {trobats.map((j) =>
            editant === j.numero ? (
              <FormulariJugador
                key={j.numero}
                jugador={j}
                onCancel={() => setEditant(null)}
                onDesat={(nou) => {
                  setLlista((actual) => actual.map((x) => (x.numero === nou.numero ? { ...x, ...nou } : x)))
                  setEditant(null)
                }}
              />
            ) : (
              <li key={j.numero} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                <span className="w-14 text-sm text-stone-400">núm. {j.numero}</span>
                <span className="font-medium">{j.nom}</span>
                <span className="text-sm text-stone-500">{j.club ?? 'sense club'}</span>
                <span className="flex-1" />
                {j.barruf !== null ? (
                  <span className="text-sm text-stone-500">
                    {j.barruf} · {j.estat}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setEditant(j.numero)}
                  className="text-sm text-stone-600 underline hover:text-stone-900"
                >
                  Editar
                </button>
              </li>
            ),
          )}
        </ul>
      ) : null}

      {trobats.length === 50 ? (
        <p className="text-sm text-stone-500">Se n&apos;ensenyen els 50 primers: afineu la cerca.</p>
      ) : null}
    </div>
  )
}

function FormulariJugador({
  jugador,
  onCancel,
  onDesat,
}: {
  jugador: JugadorEditable
  onCancel: () => void
  onDesat: (nou: { numero: number; nom: string; club: string | null }) => void
}) {
  const [nom, setNom] = useState(jugador.nom)
  const [club, setClub] = useState(jugador.club ?? '')
  const [error, setError] = useState<string | null>(null)
  const [desant, comença] = useTransition()

  function desa() {
    setError(null)
    comença(async () => {
      const resultat = await editaJugador(jugador.numero, nom, club)
      if (resultat.ok) onDesat(resultat)
      else setError(resultat.error)
    })
  }

  return (
    <li className="space-y-3 bg-stone-50 px-4 py-4">
      <div className="flex flex-wrap items-end gap-4">
        <span className="pb-2 text-sm text-stone-400">núm. {jugador.numero}</span>
        <label className="text-sm">
          <span className="block text-stone-600">Nom</span>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="mt-1 w-72 rounded border border-stone-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="block text-stone-600">Club</span>
          <input
            value={club}
            onChange={(e) => setClub(e.target.value)}
            list="clubs"
            placeholder="sense club"
            className="mt-1 w-48 rounded border border-stone-300 px-2 py-1"
          />
        </label>
        <button
          type="button"
          onClick={desa}
          disabled={desant || !nom.trim()}
          className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {desant ? 'Desant…' : 'Desa'}
        </button>
        <button type="button" onClick={onCancel} className="pb-1.5 text-sm text-stone-500 underline">
          Cancel·la
        </button>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </li>
  )
}
