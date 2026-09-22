/**
 * Adaptadors dels formats de fitxer als resultats crus.
 *
 * Aquí només hi ha la part que depèn del format: obrir un CSV o un full de
 * càlcul i acabar amb una graella de cel·les. Qui les interpreta és `fulls.ts`.
 */

import Papa from 'papaparse'

import { ErrorFull, interpretaFiles, type FilaResultat } from './fulls'

/** Extensions que sabem obrir com a full de resultats. */
export const EXTENSIONS_FULL = ['.csv', '.tsv', '.txt', '.xlsx', '.xls']

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
): Promise<ResultatsLlegits> {
  const extensio = extensioDe(nomFitxer)

  if (extensio === '.xlsx' || extensio === '.xls') {
    const pestanyes = await llegeixXlsx(dades)
    const problemes: string[] = []

    for (const pestanya of pestanyes) {
      try {
        return {
          files: interpretaFiles(pestanya.files),
          pestanya: pestanya.nom,
          altresPestanyes: pestanyes.map((p) => p.nom).filter((n) => n !== pestanya.nom),
        }
      } catch (error) {
        problemes.push(`«${pestanya.nom}»: ${(error as Error).message}`)
      }
    }

    throw new ErrorFull(
      `Cap pestanya del full no té una llista de resultats que pugui llegir.\n${problemes.join('\n')}`,
    )
  }

  if (extensio === '.csv' || extensio === '.tsv' || extensio === '.txt') {
    return {
      files: interpretaFiles(llegeixCsv(descodifica(dades))),
      pestanya: null,
      altresPestanyes: [],
    }
  }

  throw new ErrorFull(
    `No sé obrir els fitxers «${extensio || nomFitxer}». ` +
      `Els formats admesos són ${EXTENSIONS_FULL.join(', ')}.`,
  )
}
