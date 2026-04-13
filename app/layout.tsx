import type { Metadata } from 'next'
import './globals.css'
import Nav from '../components/Nav'

export const metadata: Metadata = {
  title: 'Gestió AJUSC',
  description: 'Aplicació per gestionar campionats d\'Scrabble',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ca">
      <body>
        <Nav />
        <main className="container mx-auto p-4">
          {children}
        </main>
      </body>
    </html>
  )
}