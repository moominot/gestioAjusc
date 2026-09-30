/**
 * Com s'ha mogut un jugador: fletxa amunt en verd, avall en vermell, o un
 * guionet si no s'ha mogut.
 */

/** Llocs guanyats a la classificació (positiu si ha pujat). `null` si abans no hi era. */
export function FletxaPosicio({ ara, abans }: { ara: number | null; abans: number | null }) {
  if (ara === null) return null
  if (abans === null) {
    return <span className="text-xs font-medium text-sky-700" title="Abans no tenia posició">nou</span>
  }
  return <Fletxa valor={abans - ara} titol={(n) => `${Math.abs(n)} ${Math.abs(n) === 1 ? 'lloc' : 'llocs'}`} />
}

/** Punts de BARRUF guanyats o perduts. */
export function FletxaPunts({ valor }: { valor: number | null }) {
  if (valor === null) return null
  return <Fletxa valor={Math.round(valor)} titol={(n) => `${n > 0 ? '+' : ''}${n} punts`} />
}

function Fletxa({ valor, titol }: { valor: number; titol: (n: number) => string }) {
  if (valor === 0) return <span className="text-stone-300" title="Igual">–</span>
  const puja = valor > 0
  return (
    <span
      className={`xifres inline-flex items-center gap-0.5 text-xs font-medium ${puja ? 'text-emerald-700' : 'text-red-700'}`}
      title={titol(valor)}
    >
      <span aria-hidden>{puja ? '▲' : '▼'}</span>
      {Math.abs(valor)}
    </span>
  )
}
