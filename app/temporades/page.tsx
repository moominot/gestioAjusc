'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Temporades } from '../../types/database'

export default function TemporadesPage() {
  const [temporades, setTemporades] = useState<Temporades[]>([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({ nom: '', data_inici: '', data_fi: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadTemporades()
  }, [])

  const loadTemporades = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('temporades').select('*').order('data_inici', { ascending: false })
    if (error) {
      console.error(error)
      alert('No s’han pogut carregar les temporades')
    } else if (data) {
      setTemporades(data)
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { data, error } = await supabase.from('temporades').insert([formData]).select()
    if (error) {
      console.error(error)
      alert('Error en crear la temporada')
    } else if (data) {
      setFormData({ nom: '', data_inici: '', data_fi: '' })
      loadTemporades()
    }
    setSaving(false)
  }

  if (loading) return <div>Carregant...</div>

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Temporades</h1>
          <p className="text-gray-600">Gestiona les temporades abans de crear un campionat.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inici</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {temporades.map((temporada) => (
                <tr key={temporada.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{temporada.nom}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(temporada.data_inici).toLocaleDateString('ca')}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(temporada.data_fi).toLocaleDateString('ca')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Nova Temporada</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Nom</label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Data d'inici</label>
              <input
                type="date"
                value={formData.data_inici}
                onChange={(e) => setFormData({ ...formData, data_inici: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Data de fi</label>
              <input
                type="date"
                value={formData.data_fi}
                onChange={(e) => setFormData({ ...formData, data_fi: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                required
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? 'Guardant...' : 'Crear Temporada'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
