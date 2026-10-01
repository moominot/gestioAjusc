/**
 * Com es llegeix el registre de canvis: de les files crues (abans i després en
 * JSON) a frases curtes.
 */

export interface FilaRegistre {
  taula: string
  operacio: 'INSERT' | 'UPDATE' | 'DELETE'
  abans: Record<string, unknown> | null
  despres: Record<string, unknown> | null
}

export interface Accio {
  transaccio: number
  quan: string
  usuari: string | null
  primer: number
  resum: { taula: string; operacio: FilaRegistre['operacio']; files: number }[]
  detall: FilaRegistre[]
}

export const NOM_TAULA: Record<string, [singular: string, plural: string]> = {
  campionats: ['campionat', 'campionats'],
  inscripcions: ['inscripció', 'inscripcions'],
  partides: ['partida', 'partides'],
  jugadors: ['jugador', 'jugadors'],
  jugador_alies: ['àlies', 'àlies'],
  clubs: ['club', 'clubs'],
  quotes: ['quota', 'quotes'],
  perfils: ['gestor', 'gestors'],
  barruf_edicions: ['edició del BARRUF', 'edicions del BARRUF'],
  jugadors_no_duplicats: ['parella descartada', 'parelles descartades'],
  temporades: ['temporada', 'temporades'],
}

const VERB: Record<FilaRegistre['operacio'], string> = {
  INSERT: 'creat',
  UPDATE: 'modificat',
  DELETE: 'esborrat',
}

/** «S'han creat 90 partides», «S'ha modificat 1 campionat». */
export function frase(r: Accio['resum'][number]): string {
  const [singular, plural] = NOM_TAULA[r.taula] ?? [r.taula, r.taula]
  const un = r.files === 1
  return `${un ? "S'ha" : "S'han"} ${VERB[r.operacio]} ${r.files} ${un ? singular : plural}`
}

/** Camps que no diuen res a qui llegeix el registre. */
const IGNORATS = new Set(['id', 'creat_el', 'modificat_el', 'updated_at', 'created_at'])

/** Com s'anomena una fila: el nom si en té, i si no, el que la identifiqui. */
export function etiqueta(f: FilaRegistre): string {
  const d = (f.despres ?? f.abans ?? {}) as Record<string, unknown>
  for (const camp of ['nom', 'nom_complet', 'alies', 'codi']) {
    if (typeof d[camp] === 'string' && d[camp]) return d[camp] as string
  }
  if (typeof d.numero === 'number') return `núm. ${d.numero}`
  if (typeof d.ronda === 'number') return `ronda ${d.ronda}`
  return ''
}

const text = (v: unknown) =>
  v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)

/** Els camps que han canviat en una modificació, en ordre. */
export function canvis(f: FilaRegistre): { camp: string; abans: string; despres: string }[] {
  if (f.operacio !== 'UPDATE' || !f.abans || !f.despres) return []
  return Object.keys(f.despres)
    .filter((camp) => !IGNORATS.has(camp) && JSON.stringify(f.abans![camp]) !== JSON.stringify(f.despres![camp]))
    .map((camp) => ({ camp, abans: text(f.abans![camp]), despres: text(f.despres![camp]) }))
}
