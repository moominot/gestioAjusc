'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { calcularRanking } from '../../lib/rankings'
import { Campionats, Partides, Jugadors, Temporades } from '../../types/database'

export default function RankingsPage() {
  const searchParams = useSearchParams()
  const campionatId = searchParams.get('campionat')
  const [campionats, setCampionats] = useState<Campionats[]>([])
  const [temporades, setTemporades] = useState<Temporades[]>([])
  const [selectedCampionat, setSelectedCampionat] = useState<Campionats | null>(null)
  const [rankings, setRankings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('campionats').select('*'),
      supabase.from('temporades').select('*')
    ]).then(([campRes, tempRes]) => {
      if (campRes.data) setCampionats(campRes.data)
      if (tempRes.data) setTemporades(tempRes.data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (campionatId) {
      const camp = campionats.find(c => c.id === campionatId)
      if (camp) {
        loadRankings(camp)
      }
    }
  }, [campionatId, campionats])

  const loadRankings = async (campionat: Campionats) => {
    setLoading(true)
    const { data: partides } = await supabase
      .from('partides')
      .select('*')
      .eq('campionat_id', campionat.id)

    const { data: jugadors } = await supabase
      .from('jugadors')
      .select('*')

    if (partides && jugadors) {
      const ranking = calcularRanking(partides, campionat, jugadors)
      setRankings(ranking)
      setSelectedCampionat(campionat)
    }
    setLoading(false)
  }

  if (loading) return <div>Carregant...</div>

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Rànquings</h1>
      {!selectedCampionat ? (
        <div>
          <h2 className="text-xl mb-4">Selecciona un Campionat</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campionats.map((campionat) => (
              <div key={campionat.id} className="bg-white p-4 rounded-lg shadow-md">
                <h3 className="font-semibold">{campionat.nom}</h3>
                <p>Temporada: {temporades.find(t => t.id === campionat.temporada_id)?.nom}</p>
                <p>Data: {new Date(campionat.data).toLocaleDateString('ca')}</p>
                <button
                  onClick={() => loadRankings(campionat)}
                  className="mt-2 bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                >
                  Veure Rànquing
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <button
              onClick={() => {
                setSelectedCampionat(null)
                setRankings([])
              }}
              className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600"
            >
              Tornar a la llista
            </button>
          </div>
          <h2 className="text-2xl mb-4">Rànquing: {selectedCampionat.nom}</h2>
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posició</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jugador</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Victòries</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empats</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Derrotes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Punts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diferència</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Buchholz</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Median B.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Berger</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mitjana</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rankings.map((ranking, index) => (
                  <tr key={ranking.jugador.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{ranking.jugador.nom} {ranking.jugador.cognoms}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{ranking.victories}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{ranking.empats}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{ranking.derrotes}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{ranking.puntsTotals}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{ranking.diferenciaPunts}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{ranking.buchholz.toFixed(1)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{ranking.medianBuchholz.toFixed(1)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{ranking.berger.toFixed(1)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{ranking.averagePoints.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}