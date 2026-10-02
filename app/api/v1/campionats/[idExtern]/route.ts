import { clauDe, error, json, opcions, origen } from '../../../../../lib/api/resposta'
import { clientAnonim } from '../../../../../lib/supabase/anonim'

/** En quin punt és un campionat enviat: pendent, importat (i a quin BARRUF) o descartat. */
export async function GET(peticio: Request, { params }: { params: Promise<{ idExtern: string }> }) {
  const clau = clauDe(peticio)
  if (!clau) return error(401, 'Cal la clau de l’aplicació: Authorization: Bearer <clau>.')
  const { idExtern } = await params

  const { data, error: e } = await clientAnonim().rpc('api_estat_importacio', {
    p_clau: clau,
    p_id_extern: decodeURIComponent(idExtern),
  })
  if (e) return e.code === '28000' ? error(401, 'La clau no és vàlida o s’ha revocat.') : error(500, e.message)
  if (!data) return error(404, 'Aquesta aplicació no ha enviat cap campionat amb aquest identificador.')

  const estat = data as { campionat_id: string | null }
  return json({
    ...estat,
    enllac: estat.campionat_id ? `${origen(peticio)}/campionats/${estat.campionat_id}` : null,
  })
}

export const OPTIONS = opcions
