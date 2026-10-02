/** La imatge per a les xarxes d'una edició, amb l'enllaç per baixar-la. */
export function ImatgeXarxes({ numero }: { numero: number }) {
  const src = `/barruf/imatge?edicio=${numero}`
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`Imatge per a les xarxes del BARRUF ${numero}`}
        width={1080}
        height={1080}
        className="w-full max-w-[18rem] rounded border border-stone-200"
      />
      <div className="space-y-2 text-sm">
        <p className="text-stone-600">
          Feta amb la plantilla de l’AJUSC per a les xarxes, amb el número, la data i el campionat
          d’aquesta edició.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={`${src}&baixa`}
            download={`BARRUF-${numero}-xarxes.png`}
            className="rounded-lg bg-stone-900 px-3 py-1.5 text-white hover:bg-stone-700"
          >
            Baixar la imatge
          </a>
          <a
            href={`/barruf/pdf?edicio=${numero}`}
            className="rounded-lg border border-stone-300 px-3 py-1.5 hover:border-stone-500"
          >
            PDF
          </a>
        </div>
      </div>
    </div>
  )
}
