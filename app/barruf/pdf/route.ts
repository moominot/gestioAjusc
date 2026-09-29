import { renderitzaBarruf } from '../../../lib/informe/document'
import { construeixInforme, nomFitxer, type InformeCru } from '../../../lib/informe/model'
import { clientServidor } from '../../../lib/supabase/servidor'

// La llibreria del PDF necessita Node: llegeix les fonts del disc.
export const runtime = 'nodejs'

/**
 * El PDF d'una edició del BARRUF, amb el format que publica l'AJUSC.
 *
 * `/barruf/pdf` és l'última edició i `/barruf/pdf?edicio=209` una de concreta.
 * És públic, com la classificació: només hi surt el que ja es publica.
 */
export async function GET(peticio: Request) {
  const parametre = new URL(peticio.url).searchParams.get('edicio')
  const numero = parametre === null ? null : Number(parametre)
  if (numero !== null && !Number.isInteger(numero)) {
    return new Response('El número d’edició no és vàlid.', { status: 400 })
  }

  const supabase = await clientServidor()
  const { data, error } = await supabase.rpc('informe_barruf', { p_numero: numero })
  if (error) return new Response(error.message, { status: 500 })
  if (!data) return new Response('Aquesta edició del BARRUF no existeix.', { status: 404 })

  const informe = construeixInforme(data as InformeCru)
  const pdf = await renderitzaBarruf(informe)

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(nomFitxer(informe))}`,
      // Una edició publicada no canvia mai; l'última sí que pot passar a ser-ne una altra.
      'Cache-Control': numero === null ? 'public, max-age=300, s-maxage=300' : 'public, max-age=86400, s-maxage=31536000',
    },
  })
}
