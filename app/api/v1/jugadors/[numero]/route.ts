import { error, json, opcions, PUBLIC } from '../../../../../lib/api/resposta'
import { clientAnonim } from '../../../../../lib/supabase/anonim'

/** Un jugador. Un número fusionat torna el jugador on es va fusionar. */
export async function GET(_peticio: Request, { params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params
  if (!/^\d+$/.test(numero)) return error(400, 'El número ha de ser un enter.')
  const { data, error: e } = await clientAnonim().rpc('api_jugadors', { p_numero: Number(numero) })
  if (e) return error(500, e.message)
  const jugador = (data as unknown[])[0]
  return jugador ? json(jugador, 200, PUBLIC) : error(404, `No hi ha cap jugador amb el número ${numero}.`)
}

export const OPTIONS = opcions
