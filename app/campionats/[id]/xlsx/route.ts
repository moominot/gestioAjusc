import writeExcelFile from 'write-excel-file/node'

import type { FitxaCampionat } from '../../../../lib/campionats/fitxa'
import {
  ESTATS_BARRUF,
  pestanyesCampionat,
  type FilaBarruf,
} from '../../../../lib/campionats/xlsx'
import { clientServidor } from '../../../../lib/supabase/servidor'

// La llibreria necessita Node.
export const runtime = 'nodejs'

const esUuid = (text: string) => /^[0-9a-f-]{36}$/i.test(text)

/**
 * El campionat en .xlsx: dades generals, partides (amb estadístiques i dades
 * lliures) i el darrer BARRUF publicat, una pestanya per estat. És públic, com
 * la pàgina del campionat.
 */
export async function GET(_peticio: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!esUuid(id)) return new Response('No existeix aquest campionat.', { status: 404 })

  const supabase = await clientServidor()
  const { data } = await supabase.rpc('fitxa_campionat', { p_id: id })
  const fitxa = data as FitxaCampionat | null
  if (!fitxa) return new Response('No existeix aquest campionat.', { status: 404 })

  const [{ data: camp }, { data: lliures }, ...estats] = await Promise.all([
    supabase.from('campionats').select('dades').eq('id', id).maybeSingle(),
    supabase.from('partides').select('id, dades').eq('campionat_id', id).not('dades', 'is', null),
    ...ESTATS_BARRUF.map((e) =>
      supabase
        .from('barruf_classificacio')
        .select('*')
        .eq('estat', e.clau)
        .order('barruf', { ascending: false })
        .order('nom_complet')
        .limit(5000),
    ),
  ])

  const dadesPartida = new Map((lliures ?? []).map((p) => [p.id as string, p.dades as Record<string, unknown>]))
  fitxa.partides = fitxa.partides.map((p) => ({ ...p, dades: dadesPartida.get(p.id) ?? null }))

  const barruf: Record<string, FilaBarruf[]> = {}
  ESTATS_BARRUF.forEach((e, i) => {
    barruf[e.clau] = (estats[i].data ?? []) as FilaBarruf[]
  })

  const pestanyes = pestanyesCampionat(fitxa, (camp?.dades as Record<string, unknown> | null) ?? null, barruf)
  const fitxer = await writeExcelFile(
    pestanyes.map((p) => ({
      sheet: p.nom,
      columns: p.amples.map((width) => ({ width })),
      data: p.files.map((fila, i) =>
        fila.map((v) =>
          v === null
            ? null
            : { value: v, type: typeof v === 'number' ? Number : String, ...(i === 0 ? { fontWeight: 'bold' as const } : {}) },
        ),
      ),
    })),
  ).toBuffer()

  const nom = `${fitxa.campionat.nom}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_')
  return new Response(new Uint8Array(fitxer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nom}.xlsx"`,
    },
  })
}
