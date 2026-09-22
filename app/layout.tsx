import type { Metadata } from 'next'
import Link from 'next/link'

import './globals.css'
import { gestorConnectat } from '../lib/supabase/servidor'

export const metadata: Metadata = {
  title: {
    default: 'BARRUF — AJUSC',
    template: '%s · BARRUF',
  },
  description:
    "Rànquing de Scrabble clàssic en català de l'Associació de Jugadors de Scrabble en Català.",
}

const ENLLACOS = [
  { href: '/barruf', text: 'BARRUF' },
  { href: '/campionats', text: 'Campionats' },
]

export default async function Arrel({ children }: { children: React.ReactNode }) {
  const gestor = await gestorConnectat()

  return (
    <html lang="ca">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-stone-200 bg-white">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              BARRUF
            </Link>
            <div className="flex flex-1 flex-wrap gap-x-5 gap-y-1 text-sm">
              {ENLLACOS.map((enllac) => (
                <Link
                  key={enllac.href}
                  href={enllac.href}
                  className="text-stone-600 hover:text-stone-900"
                >
                  {enllac.text}
                </Link>
              ))}
            </div>
            <Link
              href={gestor ? '/gestio' : '/entrar'}
              className="text-sm text-stone-500 hover:text-stone-900"
            >
              {gestor ? `Gestió · ${gestor.nom}` : 'Entrar'}
            </Link>
          </nav>
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
