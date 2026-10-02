import { validaImportacio } from '../../../../lib/api/importacio'
import { clauDe, error, json, opcions } from '../../../../lib/api/resposta'
import { clientAnonim } from '../../../../lib/supabase/anonim'

const MIDA_MAXIMA = 5 * 1024 * 1024

/**
 * Rep els resultats d'un campionat d'una aplicació amb clau. No es desen
 * directament: queden pendents perquè un gestor els revisi i els importi.
 * Tornar-lo a enviar amb el mateix `id_extern` substitueix la versió anterior.
 */
export async function POST(peticio: Request) {
  const clau = clauDe(peticio)
  if (!clau) return error(401, 'Cal la clau de l’aplicació: Authorization: Bearer <clau>.')

  const text = await peticio.text()
  if (text.length > MIDA_MAXIMA) return error(413, 'El cos és massa gran (màxim 5 MB).')
  let cos: unknown
  try {
    cos = JSON.parse(text)
  } catch {
    return error(400, 'El cos no és JSON vàlid.')
  }

  const validacio = validaImportacio(cos)
  if (!validacio.ok) return error(422, 'Les dades no són vàlides.', { errors: validacio.errors })

  const { data, error: e } = await clientAnonim().rpc('api_rep_importacio', {
    p_clau: clau,
    p_dades: validacio.importacio,
  })
  if (e) return e.code === '28000' ? error(401, 'La clau no és vàlida o s’ha revocat.') : error(500, e.message)

  const rebuda = data as { versio: number }
  return json(
    {
      ...rebuda,
      missatge:
        rebuda.versio > 1
          ? `Rebuda la versió ${rebuda.versio}: substitueix l’anterior i queda pendent de revisió.`
          : 'Rebut. Queda pendent que un gestor el revisi i l’importi.',
    },
    202,
  )
}

export const OPTIONS = opcions
