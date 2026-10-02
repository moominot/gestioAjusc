import { error, json, opcions, PUBLIC } from '../../../../lib/api/resposta'
import { clientAnonim } from '../../../../lib/supabase/anonim'

/**
 * El registre de jugadors amb el BARRUF actual, els àlies (noms amb què han
 * aparegut en altres campionats) i els números fusionats que hi redirigeixen.
 */
export async function GET() {
  const { data, error: e } = await clientAnonim().rpc('api_jugadors', { p_numero: null })
  if (e) return error(500, e.message)
  return json(data, 200, PUBLIC)
}

export const OPTIONS = opcions
