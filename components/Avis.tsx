/** Missatge per quan una consulta no retorna res o hi ha hagut un problema. */
export function Avis({ titol, children }: { titol: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-6">
      <p className="font-medium text-stone-900">{titol}</p>
      {children ? <div className="mt-1 text-sm text-stone-600">{children}</div> : null}
    </div>
  )
}
