import { clientServidor } from '../../../lib/supabase/servidor'
import { imatgeXarxes } from '../../../lib/xarxes/imatge'

// Llegeix la plantilla i les fonts del disc.
export const runtime = 'nodejs'

/**
 * La imatge per a les xarxes d'una edició: `/barruf/imatge` per a l'última,
 * `?edicio=211` per a una de concreta. `&baixa` la serveix com a fitxer.
 */
export async function GET(peticio: Request) {
  const params = new URL(peticio.url).searchParams
  const text = params.get('edicio')
  const numero = text === null ? null : Number(text)
  if (numero !== null && !Number.isInteger(numero)) {
    return new Response('El número d’edició no és vàlid.', { status: 400 })
  }

  const supabase = await clientServidor()
  let consulta = supabase
    .from('barruf_edicions')
    .select('numero, data_publicacio, campionats_computats')
    .order('numero', { ascending: false })
    .limit(1)
  if (numero !== null) consulta = consulta.eq('numero', numero)
  const { data, error } = await consulta.maybeSingle()
  if (error) return new Response(error.message, { status: 500 })
  if (!data) return new Response('Aquesta edició del BARRUF no existeix.', { status: 404 })

  const imatge = await imatgeXarxes({
    numero: data.numero as number,
    data: data.data_publicacio as string,
    campionat: (data.campionats_computats as string | null) ?? '',
  })
  const png = await imatge.arrayBuffer()

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `${params.has('baixa') ? 'attachment' : 'inline'}; filename="BARRUF-${data.numero}-xarxes.png"`,
      // Una edició es pot despublicar i tornar a publicar amb el mateix número.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}
