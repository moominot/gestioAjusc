/**
 * El format amb què una altra aplicació envia els resultats d'un campionat
 * (`POST /api/v1/campionats`), i la comprovació que se'n fa abans de
 * desar-lo per revisar. La documentació és a `docs/api.md`.
 */

export type DadesLliures = Record<string, unknown>

export interface ParticipantApi {
  /** L'identificador del jugador dins del torneig; les partides el citen. */
  id: string
  nom: string
  /** El número del registre del BARRUF, si l'aplicació el sap. */
  numero: number | null
}

export interface PartidaApi {
  ronda: number
  jugador_1: string
  /** `null` si el jugador 1 descansa. */
  jugador_2: string | null
  punts_1: number | null
  punts_2: number | null
  /** 1, 0.5 o 0 per al jugador 1. Si hi ha punts, es dedueix d'aquí. */
  resultat_1: number | null
  scrabbles_1: number | null
  scrabbles_2: number | null
  mot_1: string | null
  punts_mot_1: number | null
  mot_lletra_1: string | null
  punts_lletra_1: number | null
  mot_2: string | null
  punts_mot_2: number | null
  mot_lletra_2: string | null
  punts_lletra_2: number | null
  dades: DadesLliures | null
}

export interface CampionatApi {
  nom: string
  /** AAAA-MM-DD, el primer dia. */
  data: string
  organitzador: string | null
  club_organitzador: string | null
  rondes_previstes: number | null
  /** Si el torneig ja s'ha acabat. El gestor ho confirma en revisar-lo. */
  acabat: boolean
  dades: DadesLliures | null
}

export interface ImportacioApi {
  id_extern: string
  campionat: CampionatApi
  participants: ParticipantApi[]
  partides: PartidaApi[]
}

export type Validacio = { ok: true; importacio: ImportacioApi } | { ok: false; errors: string[] }

const MAX_PARTICIPANTS = 1000
const MAX_PARTIDES = 20000

const esObjecte = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Comprova el que envia l'aplicació i en treu una importació neta, o la llista d'errors. */
export function validaImportacio(cos: unknown): Validacio {
  const errors: string[] = []
  const error = (camí: string, text: string) => {
    if (errors.length < 50) errors.push(`${camí}: ${text}`)
  }

  if (!esObjecte(cos)) return { ok: false, errors: ['El cos ha de ser un objecte JSON.'] }

  const text = (v: unknown, camí: string, obligatori: boolean, max = 300): string | null => {
    if (v === undefined || v === null || v === '') {
      if (obligatori) error(camí, 'és obligatori')
      return null
    }
    if (typeof v !== 'string' && typeof v !== 'number') {
      error(camí, 'ha de ser un text')
      return null
    }
    const t = String(v).trim()
    if (t.length > max) error(camí, `massa llarg (màxim ${max} caràcters)`)
    if (!t && obligatori) error(camí, 'és obligatori')
    return t || null
  }
  const enter = (v: unknown, camí: string, opcions: { min?: number; obligatori?: boolean } = {}): number | null => {
    if (v === undefined || v === null || v === '') {
      if (opcions.obligatori) error(camí, 'és obligatori')
      return null
    }
    const n = typeof v === 'string' ? Number(v) : v
    if (typeof n !== 'number' || !Number.isInteger(n) || n < (opcions.min ?? 0)) {
      error(camí, `ha de ser un nombre enter${opcions.min ? ` a partir de ${opcions.min}` : ' positiu'}`)
      return null
    }
    return n
  }
  const lliures = (v: unknown, camí: string): DadesLliures | null => {
    if (v === undefined || v === null) return null
    if (!esObjecte(v)) {
      error(camí, 'ha de ser un objecte JSON')
      return null
    }
    if (JSON.stringify(v).length > 10000) error(camí, 'massa gran (màxim 10.000 caràcters)')
    return Object.keys(v).length ? v : null
  }

  const idExtern = text(cos.id_extern, 'id_extern', true, 200)

  // --- El campionat
  const c = esObjecte(cos.campionat) ? cos.campionat : null
  if (!c) error('campionat', 'és obligatori i ha de ser un objecte')
  const data = text(c?.data, 'campionat.data', true, 10)
  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) error('campionat.data', 'ha de ser AAAA-MM-DD')
  const campionat: CampionatApi = {
    nom: text(c?.nom, 'campionat.nom', true) ?? '',
    data: data ?? '',
    organitzador: text(c?.organitzador, 'campionat.organitzador', false),
    club_organitzador: text(c?.club_organitzador, 'campionat.club_organitzador', false, 100),
    rondes_previstes: enter(c?.rondes_previstes, 'campionat.rondes_previstes', { min: 1 }),
    acabat: c?.acabat === true,
    dades: lliures(c?.dades, 'campionat.dades'),
  }

  // --- Els participants
  const participants: ParticipantApi[] = []
  if (!Array.isArray(cos.participants) || cos.participants.length === 0) {
    error('participants', 'ha de ser una llista amb algun participant')
  } else if (cos.participants.length > MAX_PARTICIPANTS) {
    error('participants', `n'hi ha massa (màxim ${MAX_PARTICIPANTS})`)
  } else {
    const ids = new Set<string>()
    cos.participants.forEach((p, i) => {
      const camí = `participants[${i}]`
      if (!esObjecte(p)) return error(camí, 'ha de ser un objecte')
      const id = text(p.id, `${camí}.id`, true, 100)
      if (id && ids.has(id)) error(`${camí}.id`, `«${id}» està repetit`)
      if (id) ids.add(id)
      participants.push({
        id: id ?? '',
        nom: text(p.nom, `${camí}.nom`, true, 150) ?? '',
        numero: enter(p.numero, `${camí}.numero`, { min: 1 }),
      })
    })
  }
  const ids = new Set(participants.map((p) => p.id))

  // --- Les partides
  const partides: PartidaApi[] = []
  if (!Array.isArray(cos.partides)) {
    error('partides', 'ha de ser una llista (pot ser buida)')
  } else if (cos.partides.length > MAX_PARTIDES) {
    error('partides', `n'hi ha massa (màxim ${MAX_PARTIDES})`)
  } else {
    const perRonda = new Map<number, Set<string>>()
    cos.partides.forEach((p, i) => {
      const camí = `partides[${i}]`
      if (!esObjecte(p)) return error(camí, 'ha de ser un objecte')
      const ronda = enter(p.ronda, `${camí}.ronda`, { min: 1, obligatori: true })
      const j1 = text(p.jugador_1, `${camí}.jugador_1`, true, 100)
      const j2 = text(p.jugador_2, `${camí}.jugador_2`, false, 100)
      for (const [j, nom] of [[j1, 'jugador_1'], [j2, 'jugador_2']] as const) {
        if (j && !ids.has(j)) error(`${camí}.${nom}`, `«${j}» no és a la llista de participants`)
      }
      if (j1 && j1 === j2) error(camí, 'un jugador no pot jugar contra si mateix')
      if (ronda !== null) {
        const ocupats = perRonda.get(ronda) ?? new Set<string>()
        for (const j of [j1, j2]) {
          if (j && ocupats.has(j)) error(camí, `«${j}» ja té una partida a la ronda ${ronda}`)
          if (j) ocupats.add(j)
        }
        perRonda.set(ronda, ocupats)
      }

      const punts1 = enter(p.punts_1, `${camí}.punts_1`)
      const punts2 = enter(p.punts_2, `${camí}.punts_2`)
      if (j2 && (punts1 === null) !== (punts2 === null)) error(camí, 'cal la puntuació dels dos jugadors, o de cap')
      let resultat: number | null = null
      if (p.resultat_1 !== undefined && p.resultat_1 !== null) {
        const r = Number(p.resultat_1)
        if (![0, 0.5, 1].includes(r)) error(`${camí}.resultat_1`, 'ha de ser 1, 0.5 o 0')
        else resultat = r
      }
      if (j2 && punts1 === null && resultat === null) error(camí, 'cal la puntuació o el resultat')
      if (!j2) resultat = 1
      else if (punts1 !== null && punts2 !== null) resultat = punts1 > punts2 ? 1 : punts1 < punts2 ? 0 : 0.5

      const mot = (v: unknown, nom: string) => text(v, `${camí}.${nom}`, false, 30)?.toUpperCase() ?? null
      partides.push({
        ronda: ronda ?? 0,
        jugador_1: j1 ?? '',
        jugador_2: j2,
        punts_1: j2 ? punts1 : null,
        punts_2: j2 ? punts2 : null,
        resultat_1: resultat,
        scrabbles_1: enter(p.scrabbles_1, `${camí}.scrabbles_1`),
        scrabbles_2: enter(p.scrabbles_2, `${camí}.scrabbles_2`),
        mot_1: mot(p.mot_1, 'mot_1'),
        punts_mot_1: enter(p.punts_mot_1, `${camí}.punts_mot_1`),
        mot_lletra_1: mot(p.mot_lletra_1, 'mot_lletra_1'),
        punts_lletra_1: enter(p.punts_lletra_1, `${camí}.punts_lletra_1`),
        mot_2: mot(p.mot_2, 'mot_2'),
        punts_mot_2: enter(p.punts_mot_2, `${camí}.punts_mot_2`),
        mot_lletra_2: mot(p.mot_lletra_2, 'mot_lletra_2'),
        punts_lletra_2: enter(p.punts_lletra_2, `${camí}.punts_lletra_2`),
        dades: lliures(p.dades, `${camí}.dades`),
      })
    })
  }

  if (errors.length) return { ok: false, errors }
  return { ok: true, importacio: { id_extern: idExtern!, campionat, participants, partides } }
}
