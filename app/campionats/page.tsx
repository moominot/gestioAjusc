'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { Campionats, Temporades } from '../../types/database'

export default function CampionatsPage() {
  const [campionats, setCampionats] = useState<Campionats[]>([])
  const [temporades, setTemporades] = useState<Temporades[]>([])
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

  if (loading) return <div>Carregant...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Campionats</h1>
        <Link href="/campionats/nou" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Nou Campionat
        </Link>
      </div>
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Temporada</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipus</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {campionats.map((campionat) => (
              <tr key={campionat.id}>
                <td className="px-6 py-4 whitespace-nowrap">{campionat.nom}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {temporades.find(t => t.id === campionat.temporada_id)?.nom}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{new Date(campionat.data).toLocaleDateString('ca')}</td>
                <td className="px-6 py-4 whitespace-nowrap">{campionat.tipus_campionat}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link href={`/rankings?campionat=${campionat.id}`} className="text-blue-600 hover:underline">
                    Veure Rànquing
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}