'use client'

import { useEffect, useState } from 'react'

import { promptResum, textClassificacio, type DadesPrompt } from '../../../lib/campionats/promptResum'

/**
 * Botó (només per al gestor) que obre un modal per generar el prompt perquè una
 * IA redacti la crònica del campionat. Demana la classificació final: la
 * calculada no porta els desempats de l'organitzador i la IA no s'ha
 * d'inventar l'ordre.
 */
export function ResumIA({ dades }: { dades: DadesPrompt }) {
  const [obert, setObert] = useState(false)
  const [classificacio, setClassificacio] = useState('')
  const [prompt, setPrompt] = useState<string | null>(null)
  const [copiat, setCopiat] = useState(false)

  useEffect(() => {
    if (!obert) return
    const tanca = (e: KeyboardEvent) => e.key === 'Escape' && setObert(false)
    window.addEventListener('keydown', tanca)
    return () => window.removeEventListener('keydown', tanca)
  }, [obert])

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
    <>
      <button
        type="button"
        onClick={() => setObert(true)}
        className="rounded border border-stone-300 px-3 py-1 text-stone-700 hover:border-stone-500"
      >
        Resum amb IA
      </button>
      {obert ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setObert(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Resum amb IA"
            className="my-8 w-full max-w-2xl space-y-3 rounded-lg bg-white p-5 text-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Resum amb IA</h2>
                <p className="text-stone-600">
                  Genera un prompt per enganxar-lo a una IA (ChatGPT, Claude...) i que en redacti la crònica.
                </p>
              </div>
              <button type="button" onClick={() => setObert(false)} aria-label="Tanca" className="text-xl leading-none text-stone-500 hover:text-stone-900">
                ×
              </button>
            </div>
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
              <button
                type="button"
                onClick={() => {
                  setPrompt(promptResum(dades, classificacio))
                  setCopiat(false)
                }}
                className="rounded bg-stone-900 px-3 py-1.5 text-white hover:bg-stone-700"
              >
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
        </div>
      ) : null}
    </>
  )
}
