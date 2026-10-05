/**
 * Com viatgen els fitxers de l'importador entre el navegador i el servidor.
 *
 * No s'envien com a fitxers sinó com a text (base64): hi ha antivirus i
 * programes de protecció que inspeccionen els documents d'Office que es pugen
 * i tallen la pujada d'un .xlsx abans que arribi al servidor (el navegador
 * només veu un «NetworkError»). Com a text, arriben sempre. Ocupen un terç
 * més, i per això el màxim de fitxer és de 3 MB (el límit de les accions és
 * de 4 MB, i Vercel no en passa de 4,5).
 *
 * `empaqueta` es fa al navegador abans d'enviar; `desempaqueta`, al servidor
 * en rebre, i deixa el formulari com si el fitxer hagués arribat tal qual.
 */

/** La mida màxima d'un fitxer, abans de codificar-lo. */
export const MIDA_MAXIMA_FITXER = 3 * 1024 * 1024

const B64 = ':b64'
const NOM = ':nom'
const TIPUS = ':tipus'

function aBase64(bytes: Uint8Array): string {
  let binari = ''
  const tros = 0x8000
  for (let i = 0; i < bytes.length; i += tros) {
    binari += String.fromCharCode(...bytes.subarray(i, i + tros))
  }
  return btoa(binari)
}

function deBase64(text: string): Uint8Array {
  const binari = atob(text)
  const bytes = new Uint8Array(binari.length)
  for (let i = 0; i < binari.length; i++) bytes[i] = binari.charCodeAt(i)
  return bytes
}

/** Una còpia del formulari amb cada fitxer convertit en text. */
export async function empaqueta(dades: FormData): Promise<FormData> {
  const copia = new FormData()
  for (const [camp, valor] of dades.entries()) {
    if (valor instanceof File) {
      if (valor.size === 0) continue
      copia.append(camp + B64, aBase64(new Uint8Array(await valor.arrayBuffer())))
      copia.append(camp + NOM, valor.name)
      copia.append(camp + TIPUS, valor.type)
    } else {
      copia.append(camp, valor)
    }
  }
  return copia
}

/** El formulari amb els fitxers tornats a muntar. Els que ja eren fitxers, es deixen. */
export function desempaqueta(dades: FormData): FormData {
  const resultat = new FormData()
  for (const [camp, valor] of dades.entries()) {
    if (camp.endsWith(NOM) || camp.endsWith(TIPUS)) continue
    if (camp.endsWith(B64) && typeof valor === 'string') {
      const base = camp.slice(0, -B64.length)
      const nom = String(dades.get(base + NOM) ?? base)
      const tipus = String(dades.get(base + TIPUS) ?? '')
      resultat.append(base, new File([deBase64(valor) as BlobPart], nom, { type: tipus }))
    } else {
      resultat.append(camp, valor)
    }
  }
  return resultat
}
