import { consulta as troba, csv, LIMIT_COMPLET, llegeixFiltres, perBaseDeDades } from '../../../../lib/estadistiques/consultes'
import { estadistica, estadisticaDirecta } from '../../../../lib/estadistiques/cau'

/**
 * La taula d'una consulta, amb els mateixos filtres, en CSV. Dels blocs
 * `complet` (les millors jugades) dona la llista sencera.
 */
export async function GET(peticio: Request, { params }: { params: Promise<{ consulta: string }> }) {
  const c = troba((await params).consulta)
  if (!c) return new Response('No existeix aquesta consulta.', { status: 404 })
  const url = new URL(peticio.url)
  const bloc = c.blocs[Number(url.searchParams.get('bloc') ?? 0)] ?? c.blocs[0]
  const filtres = llegeixFiltres(Object.fromEntries(url.searchParams), c.minim)
  const bd = perBaseDeDades(filtres)
  const files = bloc.complet
    ? await estadisticaDirecta(bloc.metrica, bd, LIMIT_COMPLET)
    : await estadistica(bloc.metrica, bd, 1000)
  // El BOM perquè l'Excel hi vegi els accents.
  return new Response(`﻿${csv(bloc.columnes, files)}\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${c.slug}${bloc.titol ? `-${bloc.metrica}` : ''}.csv"`,
    },
  })
}
