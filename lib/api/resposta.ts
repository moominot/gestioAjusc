/**
 * Respostes de l'API v1: JSON i capçaleres perquè s'hi pugui accedir des
 * d'una web d'un altre domini. No hi ha galetes: les dades públiques no en
 * necessiten i les escriptures porten la clau de l'aplicació.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
}

export function json(cos: unknown, estat = 200, capcaleres: Record<string, string> = {}) {
  return Response.json(cos, { status: estat, headers: { ...CORS, ...capcaleres } })
}

export const error = (estat: number, missatge: string, extra: Record<string, unknown> = {}) =>
  json({ error: missatge, ...extra }, estat)

/** La resposta a la consulta prèvia del navegador (preflight). */
export const opcions = () => new Response(null, { status: 204, headers: CORS })

/** La clau de l'aplicació, de la capçalera `Authorization: Bearer …`. */
export function clauDe(peticio: Request): string | null {
  const capcalera = peticio.headers.get('authorization') ?? ''
  const m = /^Bearer\s+(\S+)$/i.exec(capcalera)
  return m ? m[1] : null
}

/** Les dades públiques poden quedar un minut en memòria cau. */
export const PUBLIC = { 'Cache-Control': 'public, max-age=60, s-maxage=60' }

/** L'adreça pública des d'on s'ha fet la petició (rere un túnel o un proxy, no la interna). */
export function origen(peticio: Request): string {
  const host = peticio.headers.get('x-forwarded-host') ?? peticio.headers.get('host')
  const protocol = peticio.headers.get('x-forwarded-proto') ?? new URL(peticio.url).protocol.replace(':', '')
  return host ? `${protocol}://${host}` : new URL(peticio.url).origin
}
