/**
 * Gràfics senzills en SVG, sense llibreries: es pinten al servidor i
 * s'adapten a l'amplada (viewBox). El detall de cada punt va al `title`.
 */

const COLOR = '#1c1917'
const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed']

/** Barres horitzontals: es llegeixen bé també en un mòbil. */
export function Barres({
  dades,
  format = (v) => v.toLocaleString('ca-ES'),
}: {
  dades: { etiqueta: string; valor: number; enllac?: string | null }[]
  format?: (v: number) => string
}) {
  if (dades.length === 0) return null
  const max = Math.max(...dades.map((d) => d.valor))
  const min = Math.min(0, ...dades.map((d) => d.valor))
  return (
    <ol className="space-y-1">
      {dades.map((d, i) => {
        const amplada = max === min ? 100 : ((d.valor - min) / (max - min)) * 100
        const etiqueta = (
          <span className="truncate">
            <span className="mr-1.5 text-stone-400">{i + 1}.</span>
            {d.etiqueta}
          </span>
        )
        return (
          <li key={i} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-2 text-xs sm:grid-cols-[minmax(0,14rem)_1fr_auto]">
            {d.enllac ? (
              <a href={d.enllac} className="truncate hover:underline">{etiqueta}</a>
            ) : (
              etiqueta
            )}
            <span className="h-3.5 rounded-sm bg-stone-100">
              <span
                className="block h-full rounded-sm"
                style={{ width: `${Math.max(1, amplada)}%`, backgroundColor: i === 0 ? '#16a34a' : COLOR, opacity: i === 0 ? 1 : 0.75 }}
              />
            </span>
            <span className="xifres w-16 text-right font-medium">{format(d.valor)}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** Línies: una o més sèries sobre unes mateixes etiquetes (p. ex. temporades). */
export function Linies({
  etiquetes,
  series,
}: {
  etiquetes: string[]
  series: { nom: string; valors: number[] }[]
}) {
  if (etiquetes.length === 0) return null
  const W = 800
  const H = 260
  const M = { e: 44, d: 12, a: 12, b: 28 }
  const tots = series.flatMap((s) => s.valors)
  const max = Math.max(1, ...tots)
  const x = (i: number) => M.e + (etiquetes.length === 1 ? 0.5 : i / (etiquetes.length - 1)) * (W - M.e - M.d)
  const y = (v: number) => H - M.b - (v / max) * (H - M.a - M.b)
  const marques = Array.from({ length: 5 }, (_, i) => Math.round((max * i) / 4))
  const cada = Math.ceil(etiquetes.length / 8)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        {marques.map((m) => (
          <g key={m}>
            <line x1={M.e} x2={W - M.d} y1={y(m)} y2={y(m)} stroke="#e7e5e4" />
            <text x={M.e - 6} y={y(m) + 4} textAnchor="end" fontSize="11" fill="#78716c">{m.toLocaleString('ca-ES')}</text>
          </g>
        ))}
        {etiquetes.map((e, i) =>
          i % cada === 0 || i === etiquetes.length - 1 ? (
            <text key={e} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#78716c">{e}</text>
          ) : null,
        )}
        {series.map((s, k) => (
          <g key={s.nom}>
            <polyline fill="none" stroke={COLORS[k % COLORS.length]} strokeWidth="2.5" points={s.valors.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
            {s.valors.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={COLORS[k % COLORS.length]}>
                <title>{`${s.nom}, ${etiquetes[i]}: ${v.toLocaleString('ca-ES')}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-stone-600">
        {series.map((s, k) => (
          <span key={s.nom} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[k % COLORS.length] }} />
            {s.nom}
          </span>
        ))}
      </p>
    </div>
  )
}

/** Núvol de punts, amb el nom de cada punt al `title`. */
export function Nuvol({
  punts,
  etiquetaX,
  etiquetaY,
  formatY = (v) => v.toLocaleString('ca-ES'),
}: {
  punts: { x: number; y: number; nom: string; enllac?: string | null }[]
  etiquetaX: string
  etiquetaY: string
  formatY?: (v: number) => string
}) {
  if (punts.length === 0) return null
  const W = 800
  const H = 320
  const M = { e: 52, d: 12, a: 12, b: 36 }
  const [x0, x1] = [0, Math.max(...punts.map((p) => p.x))]
  const ys = punts.map((p) => p.y)
  const [y0, y1] = [Math.floor(Math.min(...ys) / 10) * 10, Math.ceil(Math.max(...ys) / 10) * 10]
  const x = (v: number) => M.e + ((v - x0) / Math.max(1, x1 - x0)) * (W - M.e - M.d)
  const y = (v: number) => H - M.b - ((v - y0) / Math.max(1, y1 - y0)) * (H - M.a - M.b)
  const marquesY = Array.from({ length: 5 }, (_, i) => y0 + ((y1 - y0) * i) / 4)
  const marquesX = Array.from({ length: 6 }, (_, i) => Math.round((x1 * i) / 5))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {marquesY.map((m) => (
        <g key={m}>
          <line x1={M.e} x2={W - M.d} y1={y(m)} y2={y(m)} stroke="#e7e5e4" />
          <text x={M.e - 6} y={y(m) + 4} textAnchor="end" fontSize="11" fill="#78716c">{formatY(m)}</text>
        </g>
      ))}
      {marquesX.map((m) => (
        <text key={m} x={x(m)} y={H - 18} textAnchor="middle" fontSize="11" fill="#78716c">{m}</text>
      ))}
      <text x={(W + M.e) / 2} y={H - 3} textAnchor="middle" fontSize="11" fill="#57534e">{etiquetaX}</text>
      <text x={12} y={M.a + 4} fontSize="11" fill="#57534e">{etiquetaY}</text>
      {punts.map((p, i) => {
        const punt = (
          <circle cx={x(p.x)} cy={y(p.y)} r="4.5" fill="#2563eb" fillOpacity="0.55" stroke="#1d4ed8" strokeWidth="0.8">
            <title>{`${p.nom}: ${formatY(p.y)} en ${p.x} ${etiquetaX}`}</title>
          </circle>
        )
        return p.enllac ? <a key={i} href={p.enllac}>{punt}</a> : <g key={i}>{punt}</g>
      })}
    </svg>
  )
}
