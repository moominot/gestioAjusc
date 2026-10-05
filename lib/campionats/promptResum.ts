/**
 * El prompt perquè una IA redacti la crònica d'un campionat. Sense maquetació,
 * perquè es pugui provar.
 */
import { categoria } from '../informe/model'
import type { Estadistiques, FilaClassificacioCampionat, FitxaCampionat } from './fitxa'

export type EstatBarruf = 'nov' | 'exp' | 'act' | 'inact'

/** Un participant amb el BARRUF i l'estat d'abans i de després. `null` si no se'n sap. */
export interface CanviJugador {
  nom: string
  estatAbans: EstatBarruf | null
  estatDespres: EstatBarruf | null
  barrufAbans: number | null
  barrufDespres: number | null
}

const ESTATS: Record<EstatBarruf, string> = {
  nov: 'novell',
  exp: 'en expectativa (BARRUF provisional)',
  act: 'actiu',
  inact: 'inactiu',
}

const CATEGORIES = ['Gran Gran Mestre', 'Gran Mestre', 'Mestre', 'Expert', 'Avançat']

const NOM_CATEGORIA = (c: number | null) => (c === null ? 'sense categoria' : CATEGORIES[c - 1])

/**
 * Qui canvia d'estat o de categoria. La categoria 1 és la més alta; passar a
 * una de número més petit és pujar. Sense BARRUF abans (novell) no es parla
 * de pujada: només es diu amb quina categoria entra.
 */
export function canvisDeCategoriaIEstat(jugadors: CanviJugador[]): { estat: string[]; categoria: string[] } {
  const estat: string[] = []
  const cat: string[] = []
  for (const j of jugadors) {
    if (j.estatAbans && j.estatDespres && j.estatAbans !== j.estatDespres) {
      estat.push(`${j.nom}: de ${ESTATS[j.estatAbans]} a ${ESTATS[j.estatDespres]}`)
    }
    if (j.barrufDespres === null) continue
    const ara = categoria(j.barrufDespres)
    if (j.barrufAbans === null) {
      if (ara !== null) cat.push(`${j.nom}: entra com a ${NOM_CATEGORIA(ara)}`)
      continue
    }
    const abans = categoria(j.barrufAbans)
    if (abans === ara) continue
    const puja = ara !== null && (abans === null || ara < abans)
    cat.push(`${j.nom}: ${puja ? 'puja' : 'baixa'} de ${NOM_CATEGORIA(abans)} a ${NOM_CATEGORIA(ara)}`)
  }
  return { estat, categoria: cat }
}

export interface DadesPrompt {
  campionat: FitxaCampionat['campionat']
  notes: string
  classificacio: FilaClassificacioCampionat[]
  estadistiques: Estadistiques
  /** Amb l'estat i el BARRUF d'abans i de després de cada participant. */
  jugadors: CanviJugador[]
}

/** La classificació calculada (victòries i diferència), una línia per jugador. */
export function textClassificacio(files: FilaClassificacioCampionat[]): string {
  return files
    .map((f) => {
      const punts = f.punts_favor === null ? '' : `, ${f.punts_favor} punts (${f.diferencia! > 0 ? '+' : ''}${f.diferencia})`
      return `${f.lloc}. ${f.nom}${f.club ? ` (${f.club})` : ''} — ${f.victories} victòries en ${f.partides} partides${punts}`
    })
    .join('\n')
}

/**
 * `classificacioFinal` és la que ha enganxat el gestor (la oficial, amb els
 * desempats de l'organitzador); si és buida s'hi posa la calculada, avisant-ne.
 */
export function promptResum(dades: DadesPrompt, classificacioFinal: string): string {
  const { campionat: c, estadistiques: e } = dades
  const canvis = canvisDeCategoriaIEstat(dades.jugadors)
  const oficial = classificacioFinal.trim()
  const dia = c.data ? new Date(c.data).toLocaleDateString('ca-ES') : null

  const dadesGenerals = [
    `Nom: ${c.nom}`,
    dia ? `Data: ${dia}` : null,
    `Temporada: ${c.temporada}`,
    c.club_organitzador || c.organitzador ? `Organitza: ${c.club_organitzador ?? c.organitzador}` : null,
    `Participants: ${e.participants}`,
    `Partides: ${e.partides}`,
    `Rondes: ${e.rondes}`,
    e.mitjanaPartida !== null ? `Punts de mitjana per jugador i partida: ${Math.round(e.mitjanaPartida)}` : null,
    c.primera_edicio ? `Computat al BARRUF ${c.primera_edicio}` : null,
  ]

  const destacats = [
    e.millorPuntuacio
      ? `Millor puntuació: ${e.millorPuntuacio.punts} de ${e.millorPuntuacio.jugador}${e.millorPuntuacio.rival ? ` contra ${e.millorPuntuacio.rival}` : ''} (ronda ${e.millorPuntuacio.ronda})`
      : null,
    e.majorVictoria
      ? `Victòria més àmplia: ${e.majorVictoria.guanyador} ${e.majorVictoria.marcador} ${e.majorVictoria.perdedor} (+${e.majorVictoria.diferencia})`
      : null,
    e.partidaMesAlta ? `Partida amb més punts: ${e.partidaMesAlta.descripcio} (${e.partidaMesAlta.total})` : null,
    e.mesPujada ? `Qui més ha pujat al BARRUF: ${e.mesPujada.nom} (+${Math.round(e.mesPujada.variacio)})` : null,
    e.millorJugada
      ? `Millor jugada: ${e.millorJugada.mot ? `${e.millorJugada.mot} ` : ''}(${e.millorJugada.punts} punts) de ${e.millorJugada.jugador}, ronda ${e.millorJugada.ronda}`
      : null,
    e.millorLletra
      ? `Millor jugada amb lletra especial: ${e.millorLletra.mot ? `${e.millorLletra.mot} ` : ''}(${e.millorLletra.punts} punts) de ${e.millorLletra.jugador}, ronda ${e.millorLletra.ronda}`
      : null,
    e.mesScrabbles ? `Més scrabbles: ${e.mesScrabbles.jugador} (${e.mesScrabbles.scrabbles})` : null,
  ].filter((x): x is string => x !== null)

  const llista = (linies: (string | null)[]) =>
    linies
      .filter((x): x is string => x !== null)
      .map((x) => `- ${x}`)
      .join('\n')

  return [
    `Ets el cronista de l'AJUSC, l'Associació de Jugadors d'Scrabble en Català. Redacta, en català, un resum del campionat següent per publicar-lo a la web i a les xarxes socials.`,
    `## Dades del campionat\n${llista(dadesGenerals)}`,
    oficial
      ? `## Classificació final (oficial)\n${oficial}`
      : `## Classificació final\nL'organitzador no n'ha facilitat la classificació oficial; aquesta és la calculada per victòries i, en empat, per diferència de punts, que pot no coincidir amb la oficial:\n${textClassificacio(dades.classificacio)}`,
    destacats.length ? `## Xifres destacades\n${llista(destacats)}` : null,
    `## Canvis d'estat i de categoria\n${
      canvis.estat.length || canvis.categoria.length
        ? [...canvis.estat, ...canvis.categoria].map((x) => `- ${x}`).join('\n')
        : 'Cap jugador no canvia d\'estat ni de categoria.'
    }`,
    dades.notes.trim() ? `## Notes de l'organització\n${dades.notes.trim()}` : null,
    `## Què vull\n- Un text de 150 a 250 paraules, en un to proper i festiu, però rigorós.\n- Comença pel campió o campiona i el podi; després, els fets destacats (millors jugades, ratxes, sorpreses), els jugadors que canvien d'estat o pugen de categoria i la participació.\n- Fes servir només les dades de dalt: no t'inventis resultats, noms ni xifres. Si et falta alguna dada, deixa-la fora.\n- Acaba amb una frase de comiat i una línia de titular per a les xarxes socials.`,
  ]
    .filter((x): x is string => x !== null)
    .join('\n\n')
}
