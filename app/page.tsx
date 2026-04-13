export default function Home() {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-4">Benvingut a la Gestió AJUSC</h1>
      <p className="text-lg mb-8">
        Plataforma per gestionar jugadors, campionats i rànquings d'Scrabble.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-2">Jugadors</h2>
          <p>Gestiona la llista de jugadors registrats.</p>
          <a href="/jugadors" className="text-blue-600 hover:underline">Veure jugadors</a>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-2">Campionats</h2>
          <p>Crea i gestiona campionats d'Scrabble.</p>
          <a href="/campionats" className="text-blue-600 hover:underline">Veure campionats</a>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-2">Rànquings</h2>
          <p>Consulta els rànquings per temporada.</p>
          <a href="/rankings" className="text-blue-600 hover:underline">Veure rànquings</a>
        </div>
      </div>
    </div>
  )
}