'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'

import { CampSuggerit } from '../../../components/CampSuggerit'
import { CercaJugador, type JugadorCercable } from '../../../components/CercaJugador'
import {
  ASSIGNACIO_IGNORA,
  ASSIGNACIO_LLIURE,
  CAMPS_BASICS,
  type PropostaColumnes,
} from '../../../lib/importacio/fulls'
import { normalitzaNom } from '../../../lib/importacio/noms'
import {
  analitza,
  llegeixColumnes,
  llegeixPestanyes,
  desa,
  marcaRebuda,
  reimporta,
  type DadesCampionat,
  type Proposta,
  type ResultatDesat,
  type ResultatReimportacio,
} from './accions'
import type { ResumPestanya } from '../../../lib/importacio/fitxers'
import { Previsualitzacio } from './Previsualitzacio'

const avui = () => new Date().toISOString().slice(0, 10)

/**
 * Si el formulari porta un fitxer en aquest camp. Els camps de fitxer buits
 * també arriben al FormData (com un fitxer de 0 bytes), i un `get` sol no ho
 * distingeix.
 */
const teFitxer = (dades: FormData, camp: string) => {
  const valor = dades.get(camp)
  return valor instanceof File && valor.size > 0
}

/**
 * El que admet una petició al servidor. Vercel no accepta cossos de més de
 * 4,5 MB, i next.config.js posa el límit de les accions a 4 MB.
 */
const MIDA_MAXIMA = 4 * 1024 * 1024

/** Els fitxers que superen el límit, amb un missatge per dir-ho abans d'enviar-los. */
function massaGrans(dades: FormData): string | null {
  const grans = [...dades.values()].filter((v): v is File => v instanceof File && v.size > MIDA_MAXIMA)
  if (grans.length === 0) return null
  const mb = (n: number) => (n / 1024 / 1024).toLocaleString('ca-ES', { maximumFractionDigits: 1 })
  return (
    grans.map((f) => `«${f.name}» fa ${mb(f.size)} MB`).join(', ') +
    `, i el màxim és ${mb(MIDA_MAXIMA)} MB. Deseu-ne només la pestanya dels resultats en un fitxer nou (o com a CSV) i pugeu aquest.`
  )
}

/**
 * Una còpia del formulari amb els fitxers ja llegits a la memòria del
 * navegador. El fitxer s'envia més d'un cop (per veure'n les pestanyes, per
 * llegir-ne les columnes, per llegir els resultats), i alguns llocs d'on es
 * trien fitxers als mòbils (Drive, WhatsApp, Baixades) només els deixen llegir
 * una vegada: el segon enviament fallava amb un error de xarxa.
 */
async function ambFitxersEnMemoria(dades: FormData): Promise<FormData> {
  const copia = new FormData()
  for (const [camp, valor] of dades.entries()) {
    if (valor instanceof File && valor.size > 0) {
      copia.append(camp, new File([await valor.arrayBuffer()], valor.name, { type: valor.type }))
    } else {
      copia.append(camp, valor)
    }
  }
  return copia
}

/** Quan la petició no arriba a respondre (fitxer massa gran, connexió tallada, servidor reiniciant). */
const ERROR_XARXA =
  'No s’ha pogut enviar el fitxer al servidor: la connexió s’ha tallat o el fitxer és massa gran. ' +
  'Torneu-ho a provar; si torna a passar, deseu només la pestanya dels resultats en un fitxer nou.'

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

/** Un campionat ja desat que es torna a importar. */
export interface CampionatAReimportar {
  id: string
  nom: string
  partides: number
  /** És de l'arxiu: el BARRUF publicat no se'n recalcula. */
  arxiu: boolean
}

/** Una importació rebuda d'una altra aplicació, ja convertida en proposta. */
export interface ImportacioInicial {
  rebudaId: string
  proposta: Proposta
  registre: JugadorCercable[]
  campionat: Partial<DadesCampionat>
}

export function Importador({
  temporades,
  clubs = [],
  reimportacio,
  inicial,
}: {
  temporades: string[]
  /** Noms curts dels clubs, per suggerir l'organitzador. */
  clubs?: string[]
  reimportacio?: CampionatAReimportar
  inicial?: ImportacioInicial
}) {
  const [proposta, setProposta] = useState<Proposta | null>(inicial?.proposta ?? null)
  const [registre, setRegistre] = useState<JugadorCercable[]>(inicial?.registre ?? [])
  const [error, setError] = useState<string | null>(null)
  const [decisions, setDecisions] = useState<Record<number, number | null>>({})
  const [desat, setDesat] = useState<ResultatDesat | null>(null)
  const [reimportat, setReimportat] = useState<ResultatReimportacio | null>(null)
  const [treballant, començaTransicio] = useTransition()
  // Cap acció del servidor no ha de fallar en silenci: si la petició no arriba
  // a respondre (fitxer massa gran, connexió tallada), es diu a la pantalla.
  const comença = (feina: () => Promise<void>) =>
    començaTransicio(async () => {
      try {
        await feina()
      } catch (e) {
        // El detall tècnic, a la pantalla i a la consola: sense això no hi ha manera
        // de saber si ha estat la xarxa, el servidor o el navegador.
        console.error('Importador: la petició al servidor ha fallat', e)
        const detall = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
        setError(`${ERROR_XARXA}

Detall: ${detall} · ${new Date().toLocaleTimeString('ca-ES')}`)
      }
    })
  // Columnes de dades lliures que el gestor ha decidit no desar.
  const [excloses, setExcloses] = useState<Set<string>>(new Set())

  const [campionat, setCampionat] = useState<DadesCampionat>(() => {
    const data = inicial?.campionat.data || avui()
    return {
      nom: '',
      data,
      temporadaCodi: temporadaDe(data),
      organitzador: '',
      clubOrganitzador: '',
      computaBarruf: true,
      motiuNoComputa: '',
      finalitzat: false,
      ...inicial?.campionat,
    }
  })

  // Pas de correspondència de columnes: el que s'ha pujat i les capçaleres llegides.
  const [pujat, setPujat] = useState<FormData | null>(null)
  const [columnes, setColumnes] = useState<(PropostaColumnes & { pestanya: string | null }) | null>(
    null,
  )
  const [assignacions, setAssignacions] = useState<string[]>([])

  function obreColumnes(dades: FormData, missatge?: string) {
    comença(async () => {
      const llegides = await llegeixColumnes(dades)
      if (!llegides.ok) {
        setError(llegides.error)
        return
      }
      setError(missatge ?? null)
      setPujat(dades)
      setColumnes(llegides.columnes)
      setAssignacions(llegides.columnes.assignacions)
    })
  }

  // Fitxer amb diverses pestanyes: cal dir a quina hi ha els resultats.
  const [pestanyes, setPestanyes] = useState<ResumPestanya[] | null>(null)

  function continuaAmbFull(dades: FormData) {
    if (dades.get('revisaColumnes') && !teFitxer(dades, 'trn')) obreColumnes(dades)
    else llegeix(dades)
  }

  function triaPestanya(nom: string) {
    if (!pujat) return
    pujat.set('pestanya', nom)
    setPestanyes(null)
    continuaAmbFull(pujat)
  }

  function analitzaFitxers(original: FormData) {
    setError(null)
    original.delete('pestanya')
    const gran = massaGrans(original)
    if (gran) {
      setError(gran)
      return
    }
    començaTransicio(async () => {
      let dades: FormData
      try {
        dades = await ambFitxersEnMemoria(original)
      } catch (e) {
        console.error('Importador: no s’ha pogut llegir el fitxer al navegador', e)
        const detall = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
        setError(
          'El navegador no ha pogut llegir el fitxer triat. Si és al mòbil i ve del Drive, de WhatsApp o ' +
            'd’una altra aplicació, deseu-lo primer al dispositiu (Baixades) i trieu-lo des d’allà.' +
            `\n\nDetall: ${detall}`,
        )
        return
      }
      continuaAmbFitxers(dades)
    })
  }

  function continuaAmbFitxers(dades: FormData) {
    const esFull = teFitxer(dades, 'full')
    const esText = typeof dades.get('text') === 'string' && String(dades.get('text')).trim() !== ''
    if (esFull && !esText && !teFitxer(dades, 'trn')) {
      comença(async () => {
        const llistes = await llegeixPestanyes(dades)
        if (!llistes.ok) {
          setError(llistes.error)
          return
        }
        if (llistes.pestanyes && llistes.pestanyes.length > 1) {
          setPujat(dades)
          setPestanyes(llistes.pestanyes)
          return
        }
        continuaAmbFull(dades)
      })
      return
    }
    continuaAmbFull(dades)
  }

  /** Llegeix amb la correspondència triada, si n'hi ha. */
  function llegeix(dades: FormData, triades?: string[]) {
    if (triades) {
      dades.set('assignacions', JSON.stringify(triades))
      if (columnes?.pestanya && !dades.get('pestanya')) dades.set('pestanya', columnes.pestanya)
    }
    comença(async () => {
      const resultat = await analitza(dades)
      if (!resultat.ok) {
        if (resultat.calColumnes && !triades) {
          // No s'han reconegut les capçaleres: es deixa triar-les a mà.
          const llegides = await llegeixColumnes(dades)
          if (llegides.ok) {
            setError(resultat.error)
            setPujat(dades)
            setColumnes(llegides.columnes)
            setAssignacions(llegides.columnes.assignacions)
            return
          }
        }
        setError(resultat.error)
        return
      }
      setColumnes(null)
      setPujat(null)
      setProposta(resultat.proposta)
      setRegistre(resultat.registre)
      setCampionat((actual) => ({
        ...actual,
        nom: resultat.proposta.nom || actual.nom,
        organitzador: resultat.proposta.organitzador || actual.organitzador,
        // Si l'organitzador del fitxer és el nom d'un club, es proposa.
        clubOrganitzador:
          actual.clubOrganitzador ||
          clubs.find((c) => normalitzaNom(c) === normalitzaNom(resultat.proposta.organitzador ?? '')) ||
          '',
      }))
    })
  }

  /** La proposta sense les dades lliures que s'han desmarcat. */
  function ambDadesTriades(p: Proposta): Proposta {
    if (excloses.size === 0) return p
    const filtra = (d: Record<string, unknown> | null | undefined) => {
      if (!d) return null
      const net = Object.fromEntries(Object.entries(d).filter(([clau]) => !excloses.has(clau)))
      return Object.keys(net).length ? net : null
    }
    return {
      ...p,
      partides: p.partides.map((partida) => ({ ...partida, dades: filtra(partida.dades) })),
      dadesCampionat: filtra(p.dadesCampionat),
    }
  }

  function desaCampionat() {
    if (!proposta) return
    const propostaFinal = ambDadesTriades(proposta)
    setError(null)
    if (reimportacio) {
      const avis =
        `Se substituiran les ${reimportacio.partides} partides de «${reimportacio.nom}» per ` +
        `les ${proposta.partides.length} del fitxer. Les correccions fetes a mà es perdran. Continuar?`
      if (!window.confirm(avis)) return
      comença(async () => {
        const resultat = await reimporta(reimportacio.id, propostaFinal, decisions)
        if (!resultat.ok) setError(resultat.error)
        else {
          if (inicial) await marcaRebuda(inicial.rebudaId, reimportacio.id, 'importada')
          setReimportat(resultat)
        }
      })
      return
    }
    comença(async () => {
      const resultat = await desa(propostaFinal, campionat, decisions)
      if (!resultat.ok) setError(resultat.error)
      else {
        if (inicial) await marcaRebuda(inicial.rebudaId, resultat.campionatId, 'importada')
        setDesat(resultat)
      }
    })
  }

  const decisioDe = (participant: Proposta['participants'][number]) =>
    participant.localId in decisions ? decisions[participant.localId] : participant.jugadorNumero

  if (reimportacio && reimportat?.ok) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="font-semibold text-emerald-900">Campionat reimportat</h2>
        <p className="mt-2 text-sm text-emerald-900">
          Abans hi havia {reimportat.partidesAnteriors} partides; ara n’hi ha {reimportat.partides},
          de {reimportat.participants} participants
          {reimportat.jugadorsNous > 0 ? `, amb ${reimportat.jugadorsNous} altes noves` : null}.
        </p>
        <p className="mt-3 text-sm text-emerald-900">
          {reimportacio.arxiu
            ? 'És un campionat de l’arxiu: el BARRUF publicat no canvia.'
            : 'El BARRUF en tindrà compte la propera vegada que es publiqui.'}
        </p>
        <div className="mt-4 flex gap-3 text-sm">
          <Link href={`/campionats/${reimportacio.id}`} className="underline">
            Veure el campionat
          </Link>
        </div>
      </div>
    )
  }

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
          {inicial ? (
            <Link href="/gestio/importacions" className="underline">
              Tornar a les importacions rebudes
            </Link>
          ) : (
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
          )}
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

      {!proposta && pestanyes ? (
        <section className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
          <div>
            <h2 className="font-semibold">A quina pestanya hi ha els resultats?</h2>
            <p className="mt-1 text-sm text-stone-600">
              El fitxer té {pestanyes.length} pestanyes. Trieu la que porta la llista de partides.
            </p>
          </div>
          <ul className="divide-y divide-stone-100 rounded border border-stone-200">
            {pestanyes.map((p) => (
              <li key={p.nom} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.nom}</div>
                  <div className="truncate text-xs text-stone-500">
                    {p.files} {p.files === 1 ? 'fila' : 'files'}
                    {p.capcalera.length > 0 ? ` · ${p.capcalera.join(' | ')}` : ' · buida'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={treballant || p.files < 2}
                  onClick={() => triaPestanya(p.nom)}
                  className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-700 disabled:opacity-40"
                >
                  Fer servir aquesta
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setPestanyes(null)
              setPujat(null)
            }}
            className="text-sm text-stone-500 underline hover:text-stone-900"
          >
            Tornar enrere
          </button>
        </section>
      ) : !proposta && columnes && pujat ? (
        <CorrespondenciaColumnes
          columnes={columnes}
          assignacions={assignacions}
          setAssignacions={setAssignacions}
          treballant={treballant}
          onContinua={() => llegeix(pujat, assignacions)}
          onCancela={() => {
            setColumnes(null)
            setPujat(null)
            setError(null)
          }}
        />
      ) : !proposta ? (
        <form action={analitzaFitxers} className="space-y-6">
          <fieldset className="rounded-lg border border-stone-200 bg-white p-5">
            <legend className="px-2 text-sm font-semibold">Des del SwissPerfect</legend>
            <p className="text-sm text-stone-600">
              Els fitxers del torneig. Porten els noms, totes les rondes i la puntuació de cada
              partida. També se’n desa la taula de cada partida i, del .ini, l’àrbitre.
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
            <p className="mt-2 text-sm text-stone-600">
              Opcionalment, per a cada jugador (acabades en 1 o 2): <strong>Scrabbles</strong>, la
              millor jugada (<strong>Mot</strong> i <strong>Puntsmot</strong>) i la millor jugada
              amb lletra especial (<strong>Lletra</strong> i <strong>Punts lletra</strong>).
            </p>
            <p className="mt-2 text-sm text-stone-600">
              Qualsevol altra columna es desa com a dades lliures de la partida: per exemple{' '}
              <strong>Taula</strong>, <strong>Full</strong> i <strong>Tauler</strong> (enllaços a
              les imatges), <strong>Lloc</strong>, <strong>Hora</strong> o{' '}
              <strong>Comentaris</strong>. Abans de desar es pot triar quines.
            </p>
            <label className="mt-4 flex items-start gap-2 text-sm">
              <input type="checkbox" name="revisaColumnes" className="mt-1" />
              <span>
                <strong>Triar la correspondència de les columnes.</strong> Si les capçaleres del
                full són unes altres, podreu dir quina columna és cada cosa. Si no es reconeixen,
                es demanarà igualment.
              </span>
            </label>
            <label className="mt-4 block text-sm">
              <input
                type="file"
                name="full"
                accept=".xlsx,.xls,.ods,.csv,.tsv,.txt"
                className="mt-1 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-stone-900 file:px-3 file:py-1.5 file:text-white"
              />
            </label>
          </fieldset>

          <div className="text-center text-sm text-stone-400">o bé</div>

          <fieldset className="rounded-lg border border-stone-200 bg-white p-5">
            <legend className="px-2 text-sm font-semibold">Enganxat del full de càlcul</legend>
            <p className="text-sm text-stone-600">
              Seleccioneu les cel·les al full de càlcul, copieu-les (Ctrl+C) i enganxeu-les aquí
              (Ctrl+V). Mateixes columnes que a dalt.
            </p>
            <textarea
              name="text"
              rows={6}
              placeholder="Enganxeu aquí les files copiades del full de càlcul…"
              className="mt-3 block w-full rounded border border-stone-300 px-3 py-2 font-mono text-sm"
            />
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
              {proposta.ambEstadistiques > 0
                ? ` · ${proposta.ambEstadistiques} partides amb scrabbles o millors jugades`
                : null}
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
            {proposta.rondesPerBlocs ? (
              <p className="mt-2 text-sm text-amber-800">
                El full tornava a començar la numeració de les rondes (dues partides per ronda?):
                s’han numerat seguides, de manera que el segon bloc continua on acaba el primer.
                Per al BARRUF és indiferent.
              </p>
            ) : null}
          </section>

          {reimportacio ? null : (
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
              <div className="block text-sm">
                <span className="font-medium">Club organitzador</span>
                <div className="mt-1">
                  <CampSuggerit
                    valor={campionat.clubOrganitzador}
                    onCanvi={(v) => setCampionat({ ...campionat, clubOrganitzador: v })}
                    opcions={clubs}
                    placeholder="Escriviu per cercar-lo a la llista…"
                    nouText="club nou"
                    className="w-full rounded border border-stone-300 px-3 py-2"
                  />
                </div>
              </div>
              <label className="block text-sm">
                <span className="font-medium">Organitzador</span>
                <span className="ml-2 text-xs text-stone-500">text lliure, si no és un club</span>
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
          )}

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
                        <>
                        <CercaJugador
                          registre={registre}
                          placeholder="Cerca’l a tot el registre…"
                          onTria={(jugador) =>
                            setDecisions({ ...decisions, [participant.localId]: jugador.numero })
                          }
                        />
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
                              {candidat.nom} (núm. {candidat.numero},{' '}
                              {candidat.nivell === 'nom complet'
                                ? `${candidat.semblanca} %`
                                : candidat.nivell === 'cognoms'
                                  ? 'mateixos cognoms'
                                  : 'mateix cognom'}
                              {candidat.corroborat ? ', mateixa puntuació' : ''})
                            </option>
                          ))}
                          {/* El que s'ha triat amb el cercador, si no era entre els candidats. */}
                          {decisio !== null &&
                          !participant.candidats.some((c) => c.numero === decisio) ? (
                            <option value={decisio}>
                              {registre.find((j) => j.numero === decisio)?.nom ?? 'Jugador'} (núm.{' '}
                              {decisio}, triat del registre)
                            </option>
                          ) : null}
                        </select>
                        </>
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

          <DadesLliuresProposta proposta={proposta} excloses={excloses} setExcloses={setExcloses} />

          <Previsualitzacio
            proposta={proposta}
            decisioDe={decisioDe}
            registre={registre}
            campionat={
              reimportacio
                ? null
                : {
                    nom: campionat.nom,
                    data: campionat.data,
                    temporada: campionat.temporadaCodi,
                    estat: !campionat.computaBarruf
                      ? 'no computa per al BARRUF'
                      : campionat.finalitzat
                        ? 'acabat: entrarà a la propera publicació'
                        : 'en curs: encara no entra al BARRUF',
                  }
            }
          />

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={desaCampionat}
              disabled={treballant}
              className="rounded-lg bg-stone-900 px-4 py-2 text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {treballant
                ? 'Desant…'
                : reimportacio
                  ? 'Substituir les partides'
                  : 'Importar el campionat'}
            </button>
            {inicial ? null : (
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
            )}
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

/**
 * Les dades lliures que porta el fitxer (columnes del full que no són de les
 * conegudes, la taula del SwissPerfect, l'àrbitre...), amb un exemple de cada
 * una. Les que es desmarquen no es desen.
 */
function DadesLliuresProposta({
  proposta,
  excloses,
  setExcloses,
}: {
  proposta: Proposta
  excloses: Set<string>
  setExcloses: (s: Set<string>) => void
}) {
  const columnes = new Map<string, { partides: number; exemple: unknown }>()
  for (const p of proposta.partides) {
    for (const [clau, valor] of Object.entries(p.dades ?? {})) {
      const c = columnes.get(clau) ?? { partides: 0, exemple: valor }
      c.partides++
      columnes.set(clau, c)
    }
  }
  const campionat = Object.entries(proposta.dadesCampionat ?? {})
  if (columnes.size === 0 && campionat.length === 0) return null

  const commuta = (clau: string) => {
    const nou = new Set(excloses)
    if (nou.has(clau)) nou.delete(clau)
    else nou.add(clau)
    setExcloses(nou)
  }
  const mostra = (v: unknown) => {
    const t = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return t.length > 60 ? `${t.slice(0, 57)}…` : t
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="font-semibold">Dades lliures</h2>
      <p className="mt-1 text-sm text-stone-600">
        El que porta el fitxer a més dels resultats i les estadístiques. Es desa a cada partida i
        surt a la fitxa del campionat. Desmarqueu el que no vulgueu guardar.
      </p>
      <ul className="mt-3 space-y-1 text-sm">
        {campionat.map(([clau, valor]) => (
          <li key={`c-${clau}`} className="flex items-baseline gap-2">
            <input type="checkbox" checked={!excloses.has(clau)} onChange={() => commuta(clau)} />
            <span className="font-medium">{clau}</span>
            <span className="text-stone-500">del campionat: {mostra(valor)}</span>
          </li>
        ))}
        {[...columnes].map(([clau, { partides, exemple }]) => (
          <li key={clau} className="flex items-baseline gap-2">
            <input type="checkbox" checked={!excloses.has(clau)} onChange={() => commuta(clau)} />
            <span className="font-medium">{clau}</span>
            <span className="text-stone-500">
              a {partides} {partides === 1 ? 'partida' : 'partides'} · p. ex. {mostra(exemple)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Per a cada columna del full, a quin camp del programa correspon: un dels
 * bàsics, una dada lliure (es desa amb el nom de la capçalera) o res.
 */
function CorrespondenciaColumnes({
  columnes,
  assignacions,
  setAssignacions,
  treballant,
  onContinua,
  onCancela,
}: {
  columnes: PropostaColumnes & { pestanya: string | null }
  assignacions: string[]
  setAssignacions: (a: string[]) => void
  treballant: boolean
  onContinua: () => void
  onCancela: () => void
}) {
  const repetits = new Set(
    assignacions.filter(
      (a, i) =>
        a !== ASSIGNACIO_LLIURE && a !== ASSIGNACIO_IGNORA && assignacions.indexOf(a) !== i,
    ),
  )
  const absents = CAMPS_BASICS.filter((c) => c.obligatori && !assignacions.includes(c.clau))

  return (
    <section className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
      <div>
        <h2 className="font-semibold">Correspondència de les columnes</h2>
        <p className="mt-1 text-sm text-stone-600">
          Trieu a quin camp del programa correspon cada columna del full
          {columnes.pestanya ? ` (pestanya «${columnes.pestanya}»)` : null}. Les que marqueu com a{' '}
          <em>dada lliure</em> es desen a cada partida amb el nom de la capçalera.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="py-2 pr-4 font-medium">Columna del full</th>
              <th className="py-2 pr-4 font-medium">Exemple</th>
              <th className="py-2 font-medium">Correspon a</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {columnes.capcalera.map((nom, posicio) => {
              const valor = assignacions[posicio] ?? ASSIGNACIO_IGNORA
              return (
                <tr key={posicio}>
                  <td className="py-2 pr-4 font-medium">{nom || <em>(sense nom)</em>}</td>
                  <td className="max-w-[16rem] truncate py-2 pr-4 text-stone-500">
                    {columnes.exemples[posicio]}
                  </td>
                  <td className="py-2">
                    <select
                      value={valor}
                      onChange={(e) => {
                        const noves = [...assignacions]
                        noves[posicio] = e.target.value
                        setAssignacions(noves)
                      }}
                      className={`rounded border px-2 py-1 ${
                        repetits.has(valor) ? 'border-red-400 bg-red-50' : 'border-stone-300'
                      }`}
                    >
                      <option value={ASSIGNACIO_IGNORA}>— Ignorar</option>
                      <option value={ASSIGNACIO_LLIURE}>Dada lliure ({nom || 'sense nom'})</option>
                      <optgroup label="Camps del programa">
                        {CAMPS_BASICS.map((c) => (
                          <option key={c.clau} value={c.clau}>
                            {c.etiqueta}
                            {c.obligatori ? ' *' : ''}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {absents.length > 0 ? (
        <p className="text-sm text-amber-800">
          Falta assignar: {absents.map((c) => c.etiqueta).join(', ')}.
        </p>
      ) : null}
      {repetits.size > 0 ? (
        <p className="text-sm text-red-800">
          Hi ha camps assignats a més d’una columna: {[...repetits].join(', ')}.
        </p>
      ) : null}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onContinua}
          disabled={treballant || absents.length > 0 || repetits.size > 0}
          className="rounded-lg bg-stone-900 px-4 py-2 text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {treballant ? 'Llegint…' : 'Llegir amb aquesta correspondència'}
        </button>
        <button
          type="button"
          onClick={onCancela}
          className="text-sm text-stone-500 underline hover:text-stone-900"
        >
          Tornar enrere
        </button>
      </div>
    </section>
  )
}
