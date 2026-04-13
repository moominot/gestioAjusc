'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Clubs } from '../../types/database'

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Clubs[]>([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({ nom: '', poblacio: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadClubs()
  }, [])

  const loadClubs = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('clubs').select('*').order('nom')
    if (error) {
      console.error(error)
      alert('No s’han pogut carregar els clubs')
    } else if (data) {
      setClubs(data)
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { data, error } = await supabase.from('clubs').insert([formData]).select()
    if (error) {
      console.error(error)
      alert('Error en crear el club')
    } else if (data) {
      setFormData({ nom: '', poblacio: '' })
      loadClubs()
    }

    setSaving(false)
  }

  if (loading) return <div>Carregant...</div>

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Clubs</h1>
          <p className="text-gray-600">Gestiona els clubs i la seva informació.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Població</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clubs.map((club) => (
                <tr key={club.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{club.nom}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{club.poblacio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Nou Club</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Nom del club</label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Població</label>
              <input
                type="text"
                value={formData.poblacio}
                onChange={(e) => setFormData({ ...formData, poblacio: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                required
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? 'Guardant...' : 'Crear Club'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
