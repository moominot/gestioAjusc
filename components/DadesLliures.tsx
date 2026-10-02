/**
 * Les dades lliures (JSON) d'una partida o d'un campionat: el que no té
 * columna pròpia i arriba d'altres aplicacions. Els camps coneguts es
 * mostren amb nom; els enllaços, com a enllaços; la resta, tal com vénen.
 */

const ETIQUETES: Record<string, string> = {
  full: 'Full d’anotacions',
  tauler: 'Tauler',
  taula: 'Taula',
  lloc: 'Lloc',
  hora: 'Hora',
  comentaris: 'Comentaris',
  web: 'Web',
  arbitre: 'Àrbitre',
}

const esEnllac = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v)

function valor(clau: string, v: unknown) {
  if (esEnllac(v)) {
    return (
      <a href={v} target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-900">
        {clau === 'full' || clau === 'tauler' ? 'veure la imatge' : v.replace(/^https?:\/\//, '')}
      </a>
    )
  }
  if (v === null || v === undefined) return '—'
  return typeof v === 'object' ? JSON.stringify(v) : String(v)
}

export function DadesLliures({ dades, compacte = false }: { dades: Record<string, unknown> | null | undefined; compacte?: boolean }) {
  if (!dades || Object.keys(dades).length === 0) return null
  const claus = Object.keys(dades).sort(
    (a, b) => (a in ETIQUETES ? Object.keys(ETIQUETES).indexOf(a) : 99) - (b in ETIQUETES ? Object.keys(ETIQUETES).indexOf(b) : 99),
  )
  if (compacte) {
    return (
      <span className="flex flex-wrap justify-center gap-x-3 text-xs text-stone-500">
        {claus.map((c) => (
          <span key={c}>
            {ETIQUETES[c] ?? c}: {valor(c, dades[c])}
          </span>
        ))}
      </span>
    )
  }
  return (
    <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
      {claus.map((c) => (
        <div key={c} className="contents">
          <dt className="text-stone-500">{ETIQUETES[c] ?? c}</dt>
          <dd className="break-words">{valor(c, dades[c])}</dd>
        </div>
      ))}
    </dl>
  )
}
