/**
 * Lector mínim de fitxers dBase III.
 *
 * El SwissPerfect desa el torneig en fitxers dBase III amb extensions pròpies:
 * `.trn` (participants) i `.sco` (resultats). Aquí només hi ha el que ens cal
 * per llegir-los —camps de text, numèrics i de data, sense memos ni índexs— i
 * prou.
 *
 * Treballa sobre `Uint8Array` perquè serveixi igual des del servidor i des del
 * navegador, on els fitxers arriben d'un `<input type="file">`.
 */

export type TipusCamp = 'C' | 'N' | 'D' | 'L' | 'F'

export interface CampDbase {
  nom: string
  tipus: TipusCamp
  longitud: number
  decimals: number
}

export type ValorDbase = string | number | boolean | null

export interface TaulaDbase {
  camps: CampDbase[]
  registres: Record<string, ValorDbase>[]
}

export class ErrorDbase extends Error {
  constructor(missatge: string) {
    super(missatge)
    this.name = 'ErrorDbase'
  }
}

const MARCA_FI_CAMPS = 0x0d
const MARCA_ESBORRAT = 0x2a // '*'
const MARCA_ACTIU = 0x20 // ' '

/**
 * El SwissPerfect escriu els accents en Windows-1252, no en la pàgina de codis
 * DOS que solia fer servir el dBase. Comprovat amb els fitxers del ManaCup:
 * 'Xurí' hi surt com a 58 75 72 ED.
 */
const CODIFICACIO_PER_DEFECTE = 'windows-1252'

export function llegeixDbase(dades: Uint8Array, codificacio = CODIFICACIO_PER_DEFECTE): TaulaDbase {
  if (dades.length < 32) {
    throw new ErrorDbase('El fitxer és massa curt per ser un dBase')
  }

  const vista = new DataView(dades.buffer, dades.byteOffset, dades.byteLength)
  const versio = dades[0]
  // 0x03 és dBase III sense fitxer de memos, que és el que escriu el SwissPerfect.
  if ((versio & 0x07) !== 0x03) {
    throw new ErrorDbase(`Versió de dBase no admesa: 0x${versio.toString(16)}`)
  }

  const nombreRegistres = vista.getUint32(4, true)
  const longitudCapcalera = vista.getUint16(8, true)
  const longitudRegistre = vista.getUint16(10, true)

  const descodificador = new TextDecoder(codificacio)
  const text = (bytes: Uint8Array) => descodificador.decode(bytes).replace(/\0.*$/, '').trim()

  const camps: CampDbase[] = []
  let posicio = 32
  while (posicio < longitudCapcalera && dades[posicio] !== MARCA_FI_CAMPS) {
    if (posicio + 32 > dades.length) {
      throw new ErrorDbase('La capçalera s’acaba enmig de la definició d’un camp')
    }
    camps.push({
      nom: text(dades.subarray(posicio, posicio + 11)),
      tipus: String.fromCharCode(dades[posicio + 11]) as TipusCamp,
      longitud: dades[posicio + 16],
      decimals: dades[posicio + 17],
    })
    posicio += 32
  }

  if (camps.length === 0) {
    throw new ErrorDbase('El fitxer no declara cap camp')
  }

  const minim = longitudCapcalera + nombreRegistres * longitudRegistre
  if (dades.length < minim) {
    throw new ErrorDbase(
      `El fitxer està truncat: calen ${minim} bytes per a ${nombreRegistres} registres i només n’hi ha ${dades.length}`,
    )
  }

  const registres: Record<string, ValorDbase>[] = []
  for (let i = 0; i < nombreRegistres; i++) {
    const inici = longitudCapcalera + i * longitudRegistre
    const marca = dades[inici]
    if (marca === MARCA_ESBORRAT) continue
    if (marca !== MARCA_ACTIU) {
      throw new ErrorDbase(
        `Registre ${i + 1}: marca d’estat inesperada 0x${marca.toString(16)}`,
      )
    }

    const registre: Record<string, ValorDbase> = {}
    let desplacament = inici + 1
    for (const camp of camps) {
      const cru = text(dades.subarray(desplacament, desplacament + camp.longitud))
      desplacament += camp.longitud
      registre[camp.nom] = converteix(cru, camp)
    }
    registres.push(registre)
  }

  return { camps, registres }
}

function converteix(cru: string, camp: CampDbase): ValorDbase {
  if (cru === '') return camp.tipus === 'C' ? '' : null

  switch (camp.tipus) {
    case 'N':
    case 'F': {
      const numero = Number(cru)
      if (Number.isNaN(numero)) {
        throw new ErrorDbase(`Camp ${camp.nom}: '${cru}' no és un nombre`)
      }
      return numero
    }
    case 'L':
      return /^[YyTt]$/.test(cru)
    case 'D':
      // AAAAMMDD → AAAA-MM-DD. Si no hi encaixa, es deixa el text tal qual.
      return /^\d{8}$/.test(cru)
        ? `${cru.slice(0, 4)}-${cru.slice(4, 6)}-${cru.slice(6, 8)}`
        : cru
    default:
      return cru
  }
}
