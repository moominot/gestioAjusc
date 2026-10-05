'use client'

import { useState } from 'react'

import { promptResum, textClassificacio, type DadesPrompt } from '../../../../lib/campionats/promptResum'

/**
 * Genera el prompt perquè una IA redacti la crònica del campionat. Demana la
 * classificació final: la calculada no té els desempats de l'organitzador, i la
 * IA no se n'ha d'inventar l'ordre.
 */
export function PromptResum({ dades }: { dades: DadesPrompt }) {
  const [obert, setObert] = useState(false)
  const [classificacio, setClassificacio] = useState('')
  const [prompt, setPrompt] = useState<string | null>(null)
  const [copiat, setCopiat] = useState(false)

  const genera = () => {
    setPrompt(promptResum(dades, classificacio))
    setCopiat(false)
  }

  const copia = async () => {
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiat(true)
    } catch {
      setCopiat(false)
    }
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 text-sm">
      <h2 className="font-semibold text-stone-900">Resum amb IA</h2>
      <p className="mt-1 text-stone-600">
        Genera un prompt per enganxar-lo a una IA (ChatGPT, Claude...) i que en redacti la crònica.
      </p>
      {!obert ? (
        <button
          type="button"
          onClick={() => setObert(true)}
          className="mt-3 rounded bg-stone-900 px-3 py-1.5 text-white hover:bg-stone-700"
        >
          Generar el prompt del resum
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="font-medium">Classificació final del campionat</span>
            <span className="block text-xs text-stone-500">
              Enganxeu-hi la classificació oficial (amb els desempats de l’organitzador). Si ho deixeu
              buit, s’hi posarà la calculada per victòries i diferència de punts.
            </span>
            <textarea
              value={classificacio}
              onChange={(e) => setClassificacio(e.target.value)}
              rows={8}
              placeholder={'1. Nom Cognoms\n2. Nom Cognoms\n...'}
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1 font-mono text-xs"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={genera} className="rounded bg-stone-900 px-3 py-1.5 text-white hover:bg-stone-700">
              Genera el prompt
            </button>
            <button
              type="button"
              onClick={() => setClassificacio(textClassificacio(dades.classificacio))}
              className="rounded border border-stone-300 px-3 py-1.5 text-stone-700 hover:border-stone-500"
            >
              Omple amb la calculada
            </button>
          </div>
          {prompt ? (
            <div className="space-y-2">
              <textarea
                readOnly
                value={prompt}
                rows={14}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded border border-stone-300 bg-stone-50 px-2 py-1 font-mono text-xs"
              />
              <button type="button" onClick={copia} className="rounded border border-stone-300 px-3 py-1.5 text-stone-700 hover:border-stone-500">
                {copiat ? 'Copiat!' : 'Copia'}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
