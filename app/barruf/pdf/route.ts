import { renderitzaBarruf } from '../../../lib/informe/document'
import { destacats } from '../../../lib/informe/destacats'
import { construeixInforme, nomFitxer, type InformeCru } from '../../../lib/informe/model'
import { clientServidor } from '../../../lib/supabase/servidor'

// La llibreria del PDF necessita Node: llegeix les fonts del disc.
export const runtime = 'nodejs'

const enter = (text: string | null) => (text === null ? null : Number(text))

/**
 * El PDF d'una edició del BARRUF, amb el format que publica l'AJUSC.
 *
 *  · `/barruf/pdf`: l'última edició; `?edicio=209`, una de concreta.
 *  · `?temporada=2025-26`: l'especial de final de temporada, que compara el
 *    darrer BARRUF de la temporada anterior amb el darrer d'aquesta, amb una
 *    pàgina de destacats al final.
 *  · `?edicio=210&des_de=190`: la comparativa entre dues edicions qualssevol.
 *
 * És públic, com la classificació: només hi surt el que ja es publica.
 */
export async function GET(peticio: Request) {
  const params = new URL(peticio.url).searchParams
  const numero = enter(params.get('edicio'))
  const desDe = enter(params.get('des_de'))
  const temporada = params.get('temporada')

  if ([numero, desDe].some((n) => n !== null && !Number.isInteger(n))) {
    return new Response('El número d’edició no és vàlid.', { status: 400 })
  }
  if (temporada !== null && !/^\d{4}-\d{2}$/.test(temporada)) {
    return new Response('La temporada ha de ser com 2025-26.', { status: 400 })
  }

  const supabase = await clientServidor()
  const { data, error } =
    temporada !== null
      ? await supabase.rpc('informe_temporada', { p_temporada: temporada })
      : desDe !== null
        ? await supabase.rpc('informe_comparatiu', { p_numero: numero, p_anterior: desDe })
        : await supabase.rpc('informe_barruf', { p_numero: numero })
  if (error) return new Response(error.message, { status: 500 })
  if (!data) return new Response('Aquesta edició del BARRUF no existeix.', { status: 404 })

  const cru = data as InformeCru
  const informe = construeixInforme(cru, {
    especial: temporada !== null ? 'temporada' : desDe !== null ? 'comparativa' : undefined,
  })
  const pdf = await renderitzaBarruf(informe, informe.especial ? destacats(cru) : undefined)

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(nomFitxer(informe))}`,
      // Una edició es pot despublicar i tornar a publicar amb el mateix número:
      // no es guarda gaire, perquè no quedi el PDF vell als navegadors.
      'Cache-Control':
        numero !== null && temporada === null
          ? 'public, max-age=3600, s-maxage=3600'
          : 'public, max-age=300, s-maxage=300',
    },
  })
}
