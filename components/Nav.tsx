import Link from 'next/link'

export default function Nav() {
  return (
    <nav className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          Gestió AJUSC
        </Link>
        <div className="space-x-4">
          <Link href="/jugadors" className="hover:underline">
            Jugadors
          </Link>
          <Link href="/clubs" className="hover:underline">
            Clubs
          </Link>
          <Link href="/temporades" className="hover:underline">
            Temporades
          </Link>
          <Link href="/campionats" className="hover:underline">
            Campionats
          </Link>
          <Link href="/rankings" className="hover:underline">
            Rànquings
          </Link>
          <Link href="/campionats/nou" className="bg-green-500 px-3 py-1 rounded hover:bg-green-600">
            Nou Campionat
          </Link>
        </div>
      </div>
    </nav>
  )
}