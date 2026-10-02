import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { ImageResponse } from 'next/og'

/**
 * La imatge per anunciar a les xarxes una edició nova del BARRUF.
 *
 * El fons és la plantilla de l'AJUSC («Plantilla xarxes», a Google Slides)
 * sense els camps: les caixes verdes ja hi són pintades i aquí només s'hi
 * escriu a sobre, amb la mateixa lletra (Comfortaa).
 */

const RECURSOS = path.join(process.cwd(), 'lib/xarxes/recursos')
const COSTAT = 1080

/** Les caixes de la plantilla, en píxels de la imatge de 1080 × 1080. */
const CAIXES = {
  barruf: { x: 50, y: 340, w: 465, h: 100 },
  data: { x: 565, y: 340, w: 465, h: 100 },
  campionat: { x: 50, y: 490, w: 980, h: 100 },
} as const

const MIDA = 36

/**
 * La mida de lletra perquè un text hi càpiga: Comfortaa és ampla, uns 0,6 em
 * per caràcter de mitjana. Si no hi cap en una línia ni a 26 px, en fa dues.
 */
export function ajusta(text: string, amplada: number): { mida: number; linies: 1 | 2 } {
  const util = amplada - 40
  const enUna = Math.floor(util / (text.length * 0.6))
  if (enUna >= 26) return { mida: Math.min(MIDA, enUna), linies: 1 }
  const enDues = Math.floor(util / ((text.length / 2 + 4) * 0.6))
  return { mida: Math.max(18, Math.min(32, enDues)), linies: 2 }
}

/** «18 de setembre del 2026» */
export function dataLlarga(data: string): string {
  return new Date(`${data}T12:00:00`).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

const arrayBuffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer

let recursos: Promise<{ fons: string; regular: ArrayBuffer; negreta: ArrayBuffer }> | null = null
function carregaRecursos() {
  recursos ??= Promise.all([
    readFile(path.join(RECURSOS, 'plantilla.jpg')),
    readFile(path.join(RECURSOS, 'comfortaa-400.woff')),
    readFile(path.join(RECURSOS, 'comfortaa-700.woff')),
  ]).then(([fons, regular, negreta]) => ({
    fons: `data:image/jpeg;base64,${fons.toString('base64')}`,
    regular: arrayBuffer(regular),
    negreta: arrayBuffer(negreta),
  }))
  return recursos
}

function Caixa({ caixa, children }: { caixa: (typeof CAIXES)[keyof typeof CAIXES]; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: caixa.x,
        top: caixa.y,
        width: caixa.w,
        height: caixa.h,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 20px',
        color: 'white',
      }}
    >
      {children}
    </div>
  )
}

export async function imatgeXarxes({
  numero,
  data,
  campionat,
}: {
  numero: number
  data: string
  campionat: string
}): Promise<ImageResponse> {
  const { fons, regular, negreta } = await carregaRecursos()
  const textData = dataLlarga(data)
  const mData = ajusta(textData, CAIXES.data.w)
  const mCamp = ajusta(campionat, CAIXES.campionat.w)

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: COSTAT, height: COSTAT, fontFamily: 'Comfortaa', position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fons} width={COSTAT} height={COSTAT} style={{ position: 'absolute', left: 0, top: 0 }} alt="" />
        <Caixa caixa={CAIXES.barruf}>
          <span style={{ fontSize: MIDA }}>
            BARRUF&nbsp;<span style={{ fontWeight: 700 }}>{numero}</span>
          </span>
        </Caixa>
        <Caixa caixa={CAIXES.data}>
          <span style={{ fontSize: mData.mida }}>{textData}</span>
        </Caixa>
        <Caixa caixa={CAIXES.campionat}>
          <span style={{ fontSize: mCamp.mida, lineHeight: 1.2 }}>{campionat}</span>
        </Caixa>
      </div>
    ),
    {
      width: COSTAT,
      height: COSTAT,
      fonts: [
        { name: 'Comfortaa', data: regular, weight: 400, style: 'normal' },
        { name: 'Comfortaa', data: negreta, weight: 700, style: 'normal' },
      ],
    },
  )
}
