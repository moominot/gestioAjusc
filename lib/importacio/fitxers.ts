/**
 * Adaptadors dels formats de fitxer als resultats crus.
 *
 * Aquí només hi ha la part que depèn del format: obrir un CSV o un full de
 * càlcul i acabar amb una graella de cel·les. Qui les interpreta és `fulls.ts`.
 */

import { unzipSync, strFromU8 } from 'fflate'
import { XMLParser } from 'fast-xml-parser'
import Papa from 'papaparse'

import {
  ErrorFull,
  ErrorColumnes,
  interpretaFiles,
  proposaColumnes,
  type FilaResultat,
  type PropostaColumnes,
} from './fulls'

/** Extensions que sabem obrir com a full de resultats. */
export const EXTENSIONS_FULL = ['.csv', '.tsv', '.txt', '.xlsx', '.xls', '.ods']

/** Llibres amb pestanyes. */
const esLlibre = (extensio: string) => ['.xlsx', '.xls', '.ods'].includes(extensio)

const extensioDe = (nom: string) => {
  const punt = nom.lastIndexOf('.')
  return punt < 0 ? '' : nom.slice(punt).toLowerCase()
}

/**
 * Descodifica el text d'un CSV.
 *
 * L'Excel en català sol exportar en Windows-1252, i qui el genera amb una eina
 * moderna, en UTF-8. Es prova primer l'UTF-8 estricte, i si els bytes no hi
 * encaixen es torna a provar amb Windows-1252 en comptes de deixar-hi els
 * caràcters de substitució, que farien fallar els noms amb accent.
 */
export function descodifica(dades: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(dades).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(dades).replace(/^﻿/, '')
  }
}

/** Llegeix un CSV o un TSV. El separador es dedueix sol. */
export function llegeixCsv(text: string): unknown[][] {
  const analisi = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
    // Sense capçalera: la busca `interpretaFiles`, que accepta variants.
    header: false,
  })

  if (analisi.errors.length > 0) {
    const primer = analisi.errors[0]
    throw new ErrorFull(
      `No he pogut llegir el CSV${primer.row !== undefined ? ` (fila ${primer.row + 1})` : ''}: ${primer.message}`,
    )
  }

  return analisi.data
}

export interface PestanyaFull {
  nom: string
  files: unknown[][]
}

/**
 * Llegeix les pestanyes d'un full de càlcul.
 *
 * `read-excel-file` retorna totes les pestanyes embolcallades en
 * `{ sheet, data }` quan se li dona un fitxer sencer, i la graella pelada quan
 * se li demana una pestanya concreta. Aquí s'accepten les dues formes.
 */
export async function llegeixXlsx(dades: Uint8Array): Promise<PestanyaFull[]> {
  const { default: readXlsxFile } = await import('read-excel-file/node')
  const buffer = Buffer.from(dades.buffer, dades.byteOffset, dades.byteLength)
  const resultat = (await readXlsxFile(buffer)) as unknown

  if (!Array.isArray(resultat) || resultat.length === 0) {
    throw new ErrorFull('El full de càlcul no té cap pestanya amb dades')
  }

  const primer = resultat[0] as { sheet?: string; data?: unknown[][] }
  if (primer && typeof primer === 'object' && Array.isArray(primer.data)) {
    return (resultat as { sheet: string; data: unknown[][] }[]).map((p) => ({
      nom: p.sheet,
      files: p.data,
    }))
  }

  return [{ nom: 'Full 1', files: resultat as unknown[][] }]
}

type NodeOrdenat = Record<string, unknown> & { ':@'?: Record<string, string> }

const fills = (node: NodeOrdenat, etiqueta: string): NodeOrdenat[] =>
  (node[etiqueta] as NodeOrdenat[] | undefined) ?? []

/** Llegeix les pestanyes d'un full de càlcul OpenDocument (.ods). */
export function llegeixOds(dades: Uint8Array): PestanyaFull[] {
  let contingut: string
  try {
    const arxius = unzipSync(dades, { filter: (f) => f.name === 'content.xml' })
    if (!arxius['content.xml']) throw new Error('sense content.xml')
    contingut = strFromU8(arxius['content.xml'])
  } catch {
    throw new ErrorFull('No he pogut obrir el fitxer .ods: no sembla un full de càlcul OpenDocument vàlid.')
  }

  // Amb l'ordre preservat, perquè les cel·les cobertes (combinades) han de
  // ocupar la seva columna i no desplaçar les següents.
  const arbre = new XMLParser({
    ignoreAttributes: false,
    preserveOrder: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
  }).parse(contingut) as NodeOrdenat[]

  const document = arbre.find((n) => 'office:document-content' in n)
  const cos = fills(document ?? {}, 'office:document-content').find((n) => 'office:body' in n)
  const full = fills(cos ?? {}, 'office:body').find((n) => 'office:spreadsheet' in n)
  const taules = fills(full ?? {}, 'office:spreadsheet').filter((n) => 'table:table' in n)

  const pestanyes: PestanyaFull[] = taules.map((taula, index) => {
    const files: unknown[][] = []
    for (const fila of fills(taula, 'table:table').filter((n) => 'table:table-row' in n)) {
      const repeticions = Math.min(Number(fila[':@']?.['@_table:number-rows-repeated'] ?? 1), 1000)
      const valors: unknown[] = []
      for (const cella of fills(fila, 'table:table-row')) {
        const covertes = 'table:covered-table-cell' in cella
        if (!covertes && !('table:table-cell' in cella)) continue
        const atributs = cella[':@'] ?? {}
        const vegades = Math.min(Number(atributs['@_table:number-columns-repeated'] ?? 1), 1000)
        const tipus = atributs['@_office:value-type']
        let valor: unknown = null
        if (!covertes && tipus) {
          if (tipus === 'float' || tipus === 'percentage' || tipus === 'currency') {
            valor = Number(atributs['@_office:value'])
          } else if (tipus === 'boolean') {
            valor = atributs['@_office:boolean-value'] === 'true'
          } else if (tipus === 'date') {
            valor = atributs['@_office:date-value'] ?? null
          } else {
            const paragrafs = fills(cella, 'table:table-cell')
              .filter((n) => 'text:p' in n)
              .map((p) => textDeNodes(fills(p, 'text:p')))
            valor = paragrafs.join('\n') || null
          }
        }
        for (let i = 0; i < vegades; i++) valors.push(valor)
      }
      // El final del full repeteix files buides milers de cops: s'ignoren.
      const buida = valors.every((v) => v === null)
      if (buida && repeticions > 1) continue
      for (let i = 0; i < (buida ? 1 : repeticions); i++) files.push([...valors])
    }
    return { nom: taula[':@']?.['@_table:name'] ?? `Full ${index + 1}`, files }
  })

  if (pestanyes.length === 0) throw new ErrorFull('El full de càlcul no té cap pestanya amb dades')
  return pestanyes
}

/** El text d'un paràgraf: text pla, espais repetits i tabuladors, també dins d'enllaços i estils. */
function textDeNodes(nodes: NodeOrdenat[]): string {
  return nodes
    .map((n) => {
      if ('#text' in n) return String(n['#text'])
      if ('text:s' in n) return ' '.repeat(Number(n[':@']?.['@_text:c'] ?? 1))
      if ('text:tab' in n) return '\t'
      const [etiqueta] = Object.keys(n).filter((k) => k !== ':@')
      return etiqueta ? textDeNodes(fills(n, etiqueta)) : ''
    })
    .join('')
}

/** Totes les pestanyes d'un llibre (.xlsx o .ods). */
async function llegeixLlibre(nomFitxer: string, dades: Uint8Array): Promise<PestanyaFull[]> {
  return extensioDe(nomFitxer) === '.ods' ? llegeixOds(dades) : llegeixXlsx(dades)
}

export interface ResumPestanya {
  nom: string
  /** Files amb alguna cel·la plena. */
  files: number
  /** La primera fila amb dades, per reconèixer la pestanya. */
  capcalera: string[]
}

/**
 * Les pestanyes d'un fitxer, o `null` si no és un llibre (CSV i similars).
 * Serveix per demanar a quina hi ha els resultats quan n'hi ha més d'una.
 */
export async function llistaPestanyes(
  nomFitxer: string,
  dades: Uint8Array,
): Promise<ResumPestanya[] | null> {
  if (!esLlibre(extensioDe(nomFitxer))) return null
  const pestanyes = await llegeixLlibre(nomFitxer, dades)
  return pestanyes.map((p) => {
    const plenes = p.files.filter((f) => f.some((c) => c !== null && String(c ?? '') !== ''))
    return {
      nom: p.nom,
      files: plenes.length,
      capcalera: (plenes[0] ?? []).map((c) => String(c ?? '')).slice(0, 8),
    }
  })
}

export interface ResultatsLlegits {
  files: FilaResultat[]
  /** Pestanya d'on s'han tret, si venien d'un full de càlcul. */
  pestanya: string | null
  /** Les altres pestanyes que hi havia al fitxer, per si s'ha triat malament. */
  altresPestanyes: string[]
}

/**
 * Obre un fitxer de resultats, sigui full de càlcul o CSV.
 *
 * D'un full de càlcul se'n llegeix la primera pestanya que tingui una capçalera
 * que reconeguem; així un llibre amb pestanyes d'instruccions o de notes al
 * davant també funciona.
 */
export async function llegeixFitxerDeResultats(
  nomFitxer: string,
  dades: Uint8Array,
  triat?: { assignacions?: string[]; pestanya?: string | null },
): Promise<ResultatsLlegits> {
  const extensio = extensioDe(nomFitxer)

  if (esLlibre(extensio)) {
    const pestanyes = await llegeixLlibre(nomFitxer, dades)
    const problemes: string[] = []
    const candidates = triat?.pestanya
      ? pestanyes.filter((p) => p.nom === triat.pestanya)
      : pestanyes

    let faltenColumnes = false
    for (const pestanya of candidates) {
      try {
        return {
          files: interpretaFiles(pestanya.files, triat?.assignacions),
          pestanya: pestanya.nom,
          altresPestanyes: pestanyes.map((p) => p.nom).filter((n) => n !== pestanya.nom),
        }
      } catch (error) {
        if (error instanceof ErrorColumnes) faltenColumnes = true
        problemes.push(`«${pestanya.nom}»: ${(error as Error).message}`)
      }
    }

    throw new (faltenColumnes ? ErrorColumnes : ErrorFull)(
      `Cap pestanya del full no té una llista de resultats que pugui llegir.\n${problemes.join('\n')}`,
    )
  }

  if (extensio === '.csv' || extensio === '.tsv' || extensio === '.txt') {
    return {
      files: interpretaFiles(llegeixCsv(descodifica(dades)), triat?.assignacions),
      pestanya: null,
      altresPestanyes: [],
    }
  }

  throw new ErrorFull(
    `No sé obrir els fitxers «${extensio || nomFitxer}». ` +
      `Els formats admesos són ${EXTENSIONS_FULL.join(', ')}.`,
  )
}

export interface ColumnesLlegides extends PropostaColumnes {
  pestanya: string | null
}

/**
 * Les columnes d'un fitxer de resultats, per triar-ne la correspondència. D'un
 * full de càlcul es tria la primera pestanya que es llegeix sola i, si cap no
 * es llegeix, la primera que tingui dades.
 */
export async function llegeixColumnesDeFitxer(
  nomFitxer: string,
  dades: Uint8Array,
  pestanya?: string | null,
): Promise<ColumnesLlegides> {
  const extensio = extensioDe(nomFitxer)

  if (esLlibre(extensio)) {
    const pestanyes = (await llegeixLlibre(nomFitxer, dades)).filter(
      (p) => !pestanya || p.nom === pestanya,
    )
    let primera: ColumnesLlegides | null = null
    for (const pestanya of pestanyes) {
      try {
        const columnes = { ...proposaColumnes(pestanya.files), pestanya: pestanya.nom }
        if (!absentsEnPropostes(columnes)) return columnes
        primera ??= columnes
      } catch {
        // Una pestanya buida o sense dades: es mira la següent.
      }
    }
    if (primera) return primera
    throw new ErrorFull('Cap pestanya del full no té una capçalera i files de resultats.')
  }

  if (extensio === '.csv' || extensio === '.tsv' || extensio === '.txt') {
    return { ...proposaColumnes(llegeixCsv(descodifica(dades))), pestanya: null }
  }

  throw new ErrorFull(
    `No sé obrir els fitxers «${extensio || nomFitxer}». ` +
      `Els formats admesos són ${EXTENSIONS_FULL.join(', ')}.`,
  )
}

const absentsEnPropostes = (c: PropostaColumnes) =>
  ['jugador1', 'puntuacio1', 'jugador2', 'puntuacio2'].some((k) => !c.assignacions.includes(k))
