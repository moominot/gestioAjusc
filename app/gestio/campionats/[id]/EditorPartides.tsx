'use client'

import { useState, useTransition } from 'react'

import { CercaJugador, type JugadorCercable } from '../../../../components/CercaJugador'
import { perRonda, type PartidaCampionat } from '../../../../lib/campionats/fitxa'
import { afegeixPartida, desaPartida, esborraPartida, type DadesPartida, type Resultat } from '../accions'

/** El formulari treballa amb text; a l'hora de desar es passa a xifres. */
type Formulari = {
  ronda: string
  jugador1: number | null
  jugador2: number | null
  punts1: string
  punts2: string
  resultat1: string
  scrabbles1: string
  scrabbles2: string
  mot1: string
  puntsMot1: string
  motLletra1: string
  puntsLletra1: string
  mot2: string
  puntsMot2: string
  motLletra2: string
  puntsLletra2: string
  /** Les dades lliures, en JSON. */
  dades: string
}

const text = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v))
const xifra = (v: string) => (v.trim() === '' ? null : Number(v))
const nomesXifres = (v: string) => v.replace(/\D/g, '')

function deLaPartida(p: PartidaCampionat): Formulari {
  return {
    ronda: String(p.ronda),
    jugador1: p.numero_1,
    jugador2: p.numero_2,
    punts1: text(p.punts_1),
    punts2: text(p.punts_2),
    resultat1: text(p.resultat_1 === null ? null : Number(p.resultat_1)),
    scrabbles1: text(p.scrabbles_1),
    scrabbles2: text(p.scrabbles_2),
    mot1: text(p.mot_1),
    puntsMot1: text(p.punts_mot_1),
    motLletra1: text(p.mot_lletra_1),
    puntsLletra1: text(p.punts_lletra_1),
    mot2: text(p.mot_2),
    puntsMot2: text(p.punts_mot_2),
    motLletra2: text(p.mot_lletra_2),
    puntsLletra2: text(p.punts_lletra_2),
    dades: p.dades ? JSON.stringify(p.dades, null, 2) : '',
  }
}

const buit = (ronda: number): Formulari => ({
  ronda: String(ronda),
  jugador1: null,
  jugador2: null,
  punts1: '',
  punts2: '',
  resultat1: '',
  scrabbles1: '',
  scrabbles2: '',
  mot1: '',
  puntsMot1: '',
  motLletra1: '',
  puntsLletra1: '',
  mot2: '',
  puntsMot2: '',
  motLletra2: '',
  puntsLletra2: '',
  dades: '',
})

function perDesar(f: Formulari, descans: boolean): DadesPartida | string {
  if (f.jugador1 === null) return 'Falta el primer jugador.'
  if (!descans && f.jugador2 === null) return 'Falta el segon jugador (o marqueu que descansa).'
  let dades: Record<string, unknown> | null = null
  if (f.dades.trim()) {
    try {
      dades = JSON.parse(f.dades)
    } catch {
      return 'Les altres dades no són JSON vàlid.'
    }
    if (typeof dades !== 'object' || dades === null || Array.isArray(dades)) {
      return 'Les altres dades han de ser un objecte JSON, entre claus { }.'
    }
  }
  return {
    dades,
    ronda: Number(f.ronda),
    jugador1: f.jugador1,
    jugador2: descans ? null : f.jugador2,
    punts1: xifra(f.punts1),
    punts2: xifra(f.punts2),
    resultat1: xifra(f.resultat1),
    scrabbles1: xifra(f.scrabbles1),
    scrabbles2: xifra(f.scrabbles2),
    mot1: f.mot1,
    puntsMot1: xifra(f.puntsMot1),
    motLletra1: f.motLletra1,
    puntsLletra1: xifra(f.puntsLletra1),
    mot2: f.mot2,
    puntsMot2: xifra(f.puntsMot2),
    motLletra2: f.motLletra2,
    puntsLletra2: xifra(f.puntsLletra2),
  }
}

const petit = 'rounded border border-stone-300 px-1.5 py-0.5'

/** Totes les partides, per rondes, i el formulari per afegir-ne. */
export function EditorPartides({
  campionatId,
  partides,
  registre,
  onCanvi,
}: {
  campionatId: string
  partides: PartidaCampionat[]
  registre: JugadorCercable[]
  onCanvi: () => void
}) {
  const [afegint, setAfegint] = useState(false)
  const darreraRonda = Math.max(1, ...partides.map((p) => p.ronda))

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="font-semibold">Partides</h2>
      <p className="mt-1 text-sm text-stone-600">
        Corregiu la puntuació, o el resultat si no n&apos;hi ha (amb puntuació, guanya qui en fa més). A{' '}
        <strong>Detalls</strong> hi ha la resta: els jugadors, la ronda, els scrabbles i les millors jugades. Qui
        entra a una partida queda inscrit al campionat, i qui es queda sense cap partida en surt.
      </p>
      <div className="mt-4 space-y-4">
        {perRonda(partides).map(([ronda, llista]) => (
          <div key={ronda}>
            <h3 className="text-sm font-medium text-stone-500">Ronda {ronda}</h3>
            <ul className="mt-1 divide-y divide-stone-100">
              {llista.map((p) => (
                <FilaPartida key={p.id} campionatId={campionatId} partida={p} registre={registre} onCanvi={onCanvi} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-stone-100 pt-4">
        {afegint ? (
          <FormulariPartida
            inicial={buit(darreraRonda)}
            registre={registre}
            noms={{}}
            etiquetaDesa="Afegeix la partida"
            desa={(d) => afegeixPartida(campionatId, d)}
            onDesada={() => {
              setAfegint(false)
              onCanvi()
            }}
            onTanca={() => setAfegint(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAfegint(true)}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:border-stone-500"
          >
            + Afegeix una partida
          </button>
        )}
      </div>
    </section>
  )
}

function FilaPartida({
  campionatId,
  partida,
  registre,
  onCanvi,
}: {
  campionatId: string
  partida: PartidaCampionat
  registre: JugadorCercable[]
  onCanvi: () => void
}) {
  const [obert, setObert] = useState(false)
  const [f, setF] = useState(() => deLaPartida(partida))
  const [estat, setEstat] = useState<string | null>(null)
  const [desant, comença] = useTransition()

  const original = deLaPartida(partida)
  const canviada = (['punts1', 'punts2', 'resultat1'] as const).some((k) => f[k] !== original[k])
  const ambPunts = f.punts1 !== '' || f.punts2 !== ''
  const estadistiques = [
    partida.scrabbles_1 !== null && partida.scrabbles_1 !== undefined ? `${partida.scrabbles_1}–${partida.scrabbles_2 ?? '?'} scr.` : null,
    partida.mot_1 || partida.mot_2 ? [partida.mot_1, partida.mot_2].filter(Boolean).join(' · ') : null,
  ].filter(Boolean)

  if (obert) {
    return (
      <li className="py-3">
        <FormulariPartida
          inicial={deLaPartida(partida)}
          registre={registre}
          noms={{ [partida.numero_1]: partida.jugador_1, ...(partida.numero_2 ? { [partida.numero_2]: partida.jugador_2 ?? '' } : {}) }}
          etiquetaDesa="Desa la partida"
          desa={(d) => desaPartida(campionatId, partida.id, d)}
          esborra={() => esborraPartida(campionatId, partida.id)}
          onDesada={() => {
            setObert(false)
            onCanvi()
          }}
          onTanca={() => setObert(false)}
        />
      </li>
    )
  }

  if (partida.numero_2 === null) {
    return (
      <li className="flex items-center justify-between gap-2 py-1.5 text-sm text-stone-500">
        <span>{partida.jugador_1} descansa</span>
        <button type="button" onClick={() => setObert(true)} className="text-xs underline hover:text-stone-900">
          Detalls
        </button>
      </li>
    )
  }

  function desa() {
    setEstat(null)
    const d = perDesar(f, false)
    if (typeof d === 'string') return setEstat(d)
    comença(async () => {
      const r = await desaPartida(campionatId, partida.id, d)
      if (r.ok) {
        setEstat('Desada')
        onCanvi()
      } else setEstat(r.error)
    })
  }

  return (
    <li className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 gap-y-1 py-1.5 text-sm sm:grid-cols-[1fr_auto_1fr_auto]">
      <span className="text-right">{partida.jugador_1}</span>
      <span className="flex items-center gap-1">
        <input
          inputMode="numeric"
          value={f.punts1}
          onChange={(e) => setF({ ...f, punts1: nomesXifres(e.target.value) })}
          className={`xifres w-14 text-right ${petit}`}
          placeholder="—"
        />
        –
        <input
          inputMode="numeric"
          value={f.punts2}
          onChange={(e) => setF({ ...f, punts2: nomesXifres(e.target.value) })}
          className={`xifres w-14 ${petit}`}
          placeholder="—"
        />
        {!ambPunts ? <SelectorResultat valor={f.resultat1} onChange={(v) => setF({ ...f, resultat1: v })} /> : null}
      </span>
      <span>{partida.jugador_2}</span>
      <span className="col-span-3 flex items-center justify-end gap-2 sm:col-span-1">
        {estadistiques.length ? <span className="text-xs text-stone-400">{estadistiques.join(' · ')}</span> : null}
        {canviada ? (
          <button
            type="button"
            onClick={desa}
            disabled={desant}
            className="rounded bg-stone-900 px-2 py-0.5 text-xs text-white disabled:opacity-50"
          >
            {desant ? '…' : 'Desa'}
          </button>
        ) : null}
        <button type="button" onClick={() => setObert(true)} className="text-xs text-stone-500 underline hover:text-stone-900">
          Detalls
        </button>
        {estat ? <span className={`text-xs ${estat === 'Desada' ? 'text-emerald-700' : 'text-red-700'}`}>{estat}</span> : null}
      </span>
    </li>
  )
}

function SelectorResultat({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <select value={valor} onChange={(e) => onChange(e.target.value)} className={`ml-1 ${petit}`} title="Resultat del jugador de l'esquerra">
      <option value="">?</option>
      <option value="1">1 – 0</option>
      <option value="0.5">½ – ½</option>
      <option value="0">0 – 1</option>
    </select>
  )
}

/** Tots els camps d'una partida, per editar-la o afegir-la. */
function FormulariPartida({
  inicial,
  registre,
  noms,
  etiquetaDesa,
  desa,
  esborra,
  onDesada,
  onTanca,
}: {
  inicial: Formulari
  registre: JugadorCercable[]
  noms: Record<number, string>
  etiquetaDesa: string
  desa: (d: DadesPartida) => Promise<Resultat>
  esborra?: () => Promise<Resultat>
  onDesada: () => void
  onTanca: () => void
}) {
  const [f, setF] = useState(inicial)
  const [descans, setDescans] = useState(inicial.jugador1 !== null && inicial.jugador2 === null)
  const [error, setError] = useState<string | null>(null)
  const [desant, comença] = useTransition()
  const canvia = (k: keyof Formulari, numeric = false) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: numeric ? nomesXifres(e.target.value) : e.target.value })

  const nomDe = (n: number | null) =>
    n === null ? null : (registre.find((j) => j.numero === n)?.nom ?? noms[n] ?? `Jugador ${n}`)

  function executa(accio: () => Promise<Resultat>) {
    setError(null)
    comença(async () => {
      const r = await accio()
      if (r.ok) onDesada()
      else setError(r.error)
    })
  }

  const ambPunts = f.punts1 !== '' || f.punts2 !== ''

  const Costat = ({ c }: { c: 1 | 2 }) => {
    const numero = c === 1 ? f.jugador1 : f.jugador2
    const clau = (k: string) => `${k}${c}` as keyof Formulari
    return (
      <fieldset className="space-y-2 rounded border border-stone-200 p-3">
        <legend className="px-1 text-xs font-medium text-stone-500">Jugador {c}</legend>
        {numero !== null ? (
          <p className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">{nomDe(numero)}</span>
            <button
              type="button"
              onClick={() => setF({ ...f, [c === 1 ? 'jugador1' : 'jugador2']: null })}
              className="text-xs text-stone-500 underline hover:text-stone-900"
            >
              Canvia
            </button>
          </p>
        ) : (
          <CercaJugador
            registre={registre}
            placeholder="Cerca el jugador…"
            onTria={(j) => setF({ ...f, [c === 1 ? 'jugador1' : 'jugador2']: j.numero })}
          />
        )}
        <div className="grid grid-cols-2 gap-2 text-xs text-stone-600">
          <label>
            Punts
            <input inputMode="numeric" value={f[clau('punts')] as string} onChange={canvia(clau('punts'), true)} className={`xifres mt-0.5 block w-full ${petit}`} />
          </label>
          <label>
            Scrabbles
            <input inputMode="numeric" value={f[clau('scrabbles')] as string} onChange={canvia(clau('scrabbles'), true)} className={`xifres mt-0.5 block w-full ${petit}`} />
          </label>
          <label>
            Millor jugada
            <input value={f[clau('mot')] as string} onChange={canvia(clau('mot'))} className={`mt-0.5 block w-full font-mono uppercase ${petit}`} />
          </label>
          <label>
            Punts de la jugada
            <input inputMode="numeric" value={f[clau('puntsMot')] as string} onChange={canvia(clau('puntsMot'), true)} className={`xifres mt-0.5 block w-full ${petit}`} />
          </label>
          <label>
            Jugada amb lletra especial
            <input value={f[clau('motLletra')] as string} onChange={canvia(clau('motLletra'))} className={`mt-0.5 block w-full font-mono uppercase ${petit}`} />
          </label>
          <label>
            Punts
            <input inputMode="numeric" value={f[clau('puntsLletra')] as string} onChange={canvia(clau('puntsLletra'), true)} className={`xifres mt-0.5 block w-full ${petit}`} />
          </label>
        </div>
      </fieldset>
    )
  }

  return (
    <div className="space-y-3 rounded-lg bg-stone-50 p-3">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          Ronda
          <input inputMode="numeric" value={f.ronda} onChange={canvia('ronda', true)} className={`xifres w-14 ${petit}`} />
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={descans} onChange={(e) => setDescans(e.target.checked)} />
          El jugador 1 descansa (compta com a victòria)
        </label>
        {!descans && !ambPunts ? (
          <label className="flex items-center gap-1.5">
            Resultat sense puntuació
            <SelectorResultat valor={f.resultat1} onChange={(v) => setF({ ...f, resultat1: v })} />
          </label>
        ) : null}
      </div>
      {/* Funcions i no components: si no, cada tecla tornaria a muntar els camps i perdrien el focus. */}
      <div className={`grid gap-3 ${descans ? '' : 'sm:grid-cols-2'}`}>
        {Costat({ c: 1 })}
        {descans ? null : Costat({ c: 2 })}
      </div>
      <label className="block text-xs text-stone-600">
        Altres dades (JSON): enllaç al full o al tauler, taula, lloc, hora, comentaris…
        <textarea
          value={f.dades}
          onChange={(e) => setF({ ...f, dades: e.target.value })}
          rows={f.dades ? Math.min(8, f.dades.split('\n').length + 1) : 2}
          placeholder={'{ "full": "https://…", "taula": 5, "comentaris": "…" }'}
          className={`mt-0.5 block w-full font-mono ${petit}`}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={desant}
          onClick={() => {
            const d = perDesar(f, descans)
            if (typeof d === 'string') return setError(d)
            executa(() => desa(d))
          }}
          className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {desant ? 'Desant…' : etiquetaDesa}
        </button>
        <button type="button" onClick={onTanca} className="text-sm text-stone-600 underline">
          Cancel·la
        </button>
        {esborra ? (
          <button
            type="button"
            disabled={desant}
            onClick={() => {
              if (window.confirm('Segur que voleu esborrar aquesta partida?')) executa(esborra)
            }}
            className="ml-auto text-sm text-red-700 underline hover:text-red-900"
          >
            Esborra la partida
          </button>
        ) : null}
        {error ? <span className="w-full text-sm text-red-700">{error}</span> : null}
      </div>
    </div>
  )
}
