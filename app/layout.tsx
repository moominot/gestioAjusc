import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}