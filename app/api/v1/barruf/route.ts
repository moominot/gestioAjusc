import { error, json, opcions, PUBLIC } from '../../../../lib/api/resposta'
import { clientAnonim } from '../../../../lib/supabase/anonim'

/** La classificació de l'última edició del BARRUF. */
export async function GET() {
  const { data, error: e } = await clientAnonim().rpc('api_barruf')
  if (e) return error(500, e.message)
  return json(data, 200, PUBLIC)
}

export const OPTIONS = opcions
