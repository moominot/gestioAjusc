import type { Metadata } from 'next'

import './globals.css'
import { Navegacio } from '../components/Navegacio'
import { gestorConnectat } from '../lib/supabase/servidor'

export const metadata: Metadata = {
  title: {
    default: 'BARRUF — AJUSC',
    template: '%s · BARRUF',
  },
  description:
    "Rànquing de Scrabble clàssic en català de l'Associació de Jugadors de Scrabble en Català.",
}

export default async function Arrel({ children }: { children: React.ReactNode }) {
  const gestor = await gestorConnectat()

  return (
    <html lang="ca">
      <body className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
          <Navegacio gestor={gestor?.nom ?? null} />
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>

        <footer className="border-t border-stone-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-stone-500">
            Associació de Jugadors de Scrabble en Català ·{' '}
            <a href="https://www.ajuscrabble.cat" className="underline hover:text-stone-900">
              ajuscrabble.cat
            </a>
          </div>
        </footer>
      </body>
    </html>
  )
}
