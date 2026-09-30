/**
 * Destacats d'una comparativa entre dues edicions del BARRUF: qui ha pujat i
 * baixat més, qui ha jugat i guanyat més, els debutants, els que tornen, els
 * canvis de categoria i el podi.
 *
 * Tot surt del mateix que el PDF (`InformeCru`), de manera que el resum i la
 * taula no es poden contradir.
 */

import { arrodoneix } from '../barruf/motor'
import { categoria, type FilaCrua, type InformeCru } from './model'

export interface JugadorDestacat {
  numero: number
  nom: string
  club: string | null
  /** El valor pel qual destaca, ja preparat per mostrar: «+129», «61 partides». */
  valor: string
}

export interface CanviCategoria extends JugadorDestacat {
  abans: number | null
  ara: number
}

export interface Destacats {
  numero: number
  anterior: number
  temporada: string
  xifres: {
    actius: number
    ambPartides: number
    partides: number
    campionats: number | null
    debutants: number
    recuperats: number
  }
  podi: { ara: JugadorDestacat[]; abans: JugadorDestacat[] }
  mesPujada: JugadorDestacat[]
  mesBaixada: JugadorDestacat[]
  mesPosicions: JugadorDestacat[]
  mesPartides: JugadorDestacat[]
  mesVictories: JugadorDestacat[]
  millorPercentatge: JugadorDestacat[]
  debutants: JugadorDestacat[]
  recuperats: JugadorDestacat[]
  pujadesCategoria: CanviCategoria[]
}

/** Partides mínimes de la temporada per entrar al rànquing de percentatge. */
export const MINIM_PERCENTATGE = 20
const QUANTS = 5

const amb = (valor: number) => (valor > 0 ? `+${valor}` : String(valor))
const decimal = (valor: number) => valor.toFixed(1).replace('.', ',').replace(/,0$/, '')

const jugador = (f: FilaCrua, valor: string): JugadorDestacat => ({
  numero: f.numero,
  nom: f.nom,
  club: f.club,
  valor,
})

/** Els primers `n` per una clau, sense repetir empats a mitges: si l'últim empata, entren tots. */
function primers<T>(llista: T[], clau: (x: T) => number, n = QUANTS): T[] {
  const ordenats = [...llista].sort((a, b) => clau(b) - clau(a))
  if (ordenats.length <= n) return ordenats
  const tall = clau(ordenats[n - 1])
  return ordenats.filter((x, i) => i < n || clau(x) === tall)
}

export function destacats(cru: InformeCru): Destacats {
  const files = cru.files
  const actius = files.filter((f) => f.estat === 'act')
  const hanJugat = files.filter((f) => f.partides_temporada > 0)
  const prg = (f: FilaCrua) => arrodoneix(f.barruf) - arrodoneix(f.anterior!.barruf)
  // Per a pujades i baixades, qui ja tenia un BARRUF ferm i ha jugat: el salt
  // d'un debutant des dels 950 de sortida no és una progressió.
  const comparables = hanJugat.filter((f) => f.anterior && f.anterior.partides_totals > 10 && !f.debutant)
  const ambPosicions = actius.filter((f) => f.posicio !== null && f.anterior?.posicio != null)
  const debutants = actius.filter((f) => f.debutant)
  const recuperats = actius.filter((f) => !f.debutant && f.anterior && f.anterior.posicio === null)
  const percentatge = (f: FilaCrua) => f.victories_temporada / f.partides_temporada
  const perPosicio = (a: FilaCrua, b: FilaCrua) => (a.posicio ?? 0) - (b.posicio ?? 0)

  const podiAbans = files
    .filter((f) => f.anterior?.posicio != null && f.anterior.posicio <= 3)
    .sort((a, b) => a.anterior!.posicio! - b.anterior!.posicio!)

  const pujadesCategoria: CanviCategoria[] = actius
    .map((f) => ({ f, abans: f.anterior ? categoria(f.anterior.barruf) : null, ara: categoria(f.barruf) }))
    // Com més petit el número, més alta la categoria (❶ és Gran Gran Mestre).
    .filter((x): x is { f: FilaCrua; abans: number; ara: number } =>
      x.ara !== null && x.abans !== null && x.ara < x.abans)
    .sort((a, b) => a.ara - b.ara || b.f.barruf - a.f.barruf)
    .map(({ f, abans, ara }) => ({ ...jugador(f, String(arrodoneix(f.barruf))), abans, ara }))

  return {
    numero: cru.edicio.numero,
    anterior: cru.anterior ?? 0,
    temporada: cru.edicio.temporada,
    xifres: {
      actius: actius.length,
      ambPartides: hanJugat.length,
      partides: Math.round(hanJugat.reduce((s, f) => s + f.partides_temporada, 0) / 2),
      campionats: cru.campionats_temporada ?? null,
      debutants: debutants.length,
      recuperats: recuperats.length,
    },
    podi: {
      ara: actius.filter((f) => f.posicio !== null && f.posicio <= 3).sort(perPosicio)
        .map((f) => jugador(f, String(arrodoneix(f.barruf)))),
      abans: podiAbans.map((f) => jugador(f, String(arrodoneix(f.anterior!.barruf)))),
    },
    mesPujada: primers(comparables.filter((f) => prg(f) > 0), prg).map((f) => jugador(f, amb(prg(f)))),
    mesBaixada: primers(comparables.filter((f) => prg(f) < 0), (f) => -prg(f)).map((f) => jugador(f, amb(prg(f)))),
    mesPosicions: primers(
      ambPosicions.filter((f) => f.anterior!.posicio! > f.posicio!),
      (f) => f.anterior!.posicio! - f.posicio!,
    ).map((f) => jugador(f, `+${f.anterior!.posicio! - f.posicio!} (${f.anterior!.posicio!}a → ${f.posicio}a)`)),
    mesPartides: primers(hanJugat, (f) => f.partides_temporada).map((f) => jugador(f, `${f.partides_temporada} partides`)),
    mesVictories: primers(hanJugat, (f) => f.victories_temporada).map((f) =>
      jugador(f, `${decimal(f.victories_temporada)} victòries`)),
    millorPercentatge: primers(hanJugat.filter((f) => f.partides_temporada >= MINIM_PERCENTATGE), percentatge).map((f) =>
      jugador(f, `${Math.round(percentatge(f) * 100)}% (${decimal(f.victories_temporada)} de ${f.partides_temporada})`)),
    debutants: [...debutants].sort(perPosicio).map((f) => jugador(f, `${arrodoneix(f.barruf)}, ${f.posicio}a posició`)),
    recuperats: [...recuperats].sort(perPosicio).map((f) => jugador(f, `${arrodoneix(f.barruf)}, ${f.posicio}a posició`)),
    pujadesCategoria,
  }
}
