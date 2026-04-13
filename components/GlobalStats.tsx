'use client'

import { Jugadors } from '../types/database'

interface GlobalStatsProps {
  jugadors: Jugadors[]
}

export function GlobalStats({ jugadors }: GlobalStatsProps) {
  const totalJugadors = jugadors.length
  const totalSocis = jugadors.filter((j) => j.es_soci).length
  const moyBarruf = jugadors.length > 0
    ? Math.round(jugadors.reduce((sum, j) => sum + (j.barruf ?? 0), 0) / jugadors.length)
    : 0
  const maxBarruf = jugadors.length > 0 ? Math.max(...jugadors.map((j) => j.barruf ?? 0)) : 0
  const minBarruf = jugadors.length > 0 ? Math.min(...jugadors.filter((j) => j.barruf).map((j) => j.barruf ?? 0)) : 0

  const jugadorsAmbEdatUdefinida = jugadors.filter((j) => j.data_naixement).length
  const edatMitjana = jugadorsAmbEdatUdefinida > 0
    ? jugadors
        .filter((j) => j.data_naixement)
        .map((j) => {
          const birth = new Date(j.data_naixement!)
          const today = new Date()
          return Math.floor((today.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        })
        .reduce((a, b) => a + b, 0) / jugadorsAmbEdatUdefinida
    : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
        <div className="text-sm text-gray-600 font-medium">Total Jugadors</div>
        <div className="text-3xl font-bold text-blue-600">{totalJugadors}</div>
      </div>

      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
        <div className="text-sm text-gray-600 font-medium">Socis</div>
        <div className="text-3xl font-bold text-green-600">{totalSocis}</div>
        <div className="text-xs text-gray-500 mt-1">{totalJugadors > 0 ? ((totalSocis / totalJugadors) * 100).toFixed(1) : 0}%</div>
      </div>

      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
        <div className="text-sm text-gray-600 font-medium">Barruf Mitjà</div>
        <div className="text-3xl font-bold text-purple-600">{moyBarruf}</div>
      </div>

      <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
        <div className="text-sm text-gray-600 font-medium">Barruf Màxim</div>
        <div className="text-3xl font-bold text-orange-600">{maxBarruf}</div>
      </div>

      <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
        <div className="text-sm text-gray-600 font-medium">Barruf Mínim</div>
        <div className="text-3xl font-bold text-red-600">{minBarruf}</div>
      </div>

      <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 border border-indigo-200">
        <div className="text-sm text-gray-600 font-medium">Edat Mitjana</div>
        <div className="text-3xl font-bold text-indigo-600">{edatMitjana.toFixed(1)}</div>
        <div className="text-xs text-gray-500 mt-1">anys</div>
      </div>
    </div>
  )
}
