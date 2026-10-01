'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ENLLACOS = [
  { href: '/barruf', text: 'BARRUF' },
  { href: '/campionats', text: 'Campionats' },
  { href: '/clubs', text: 'Clubs' },
]

/**
 * La barra de dalt. En un mòbil va en dues línies: el nom i l'entrada a dalt,
 * i les seccions a sota en una sola fila. En pantalla gran, tot en una línia.
 * La secció on s'és queda marcada.
 */
export function Navegacio({ gestor }: { gestor: string | null }) {
  const ruta = usePathname()
  const actiu = (href: string) => ruta === href || ruta.startsWith(`${href}/`) || (href === '/barruf' && ruta.startsWith('/jugadors'))

  return (
    <nav className="mx-auto grid max-w-5xl grid-cols-[1fr_auto] items-center gap-x-6 px-4 sm:flex sm:py-3">
      <Link href="/" className="py-3 text-lg font-semibold tracking-tight sm:py-0">
        BARRUF
      </Link>
      <Link
        href={gestor ? '/gestio' : '/entrar'}
        className="justify-self-end text-sm text-stone-500 hover:text-stone-900 sm:order-last sm:ml-auto"
      >
        {gestor ? `Gestió · ${gestor}` : 'Entrar'}
      </Link>
      <div className="col-span-2 -mx-4 flex gap-1 overflow-x-auto border-t border-stone-100 px-2 sm:mx-0 sm:border-0 sm:px-0">
        {ENLLACOS.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm sm:py-1 ${
              actiu(e.href)
                ? 'border-stone-900 font-medium text-stone-900'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            {e.text}
          </Link>
        ))}
      </div>
    </nav>
  )
}
