'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Temporades, Jugadors } from '../../types/database'
import { findSimilarPlayers } from '../../lib/nameMatching'
import Papa from 'papaparse'

interface PlayerResolution {
  name: string
  suggestions: { player: Jugadors; similarity: number }[]
  selectedId: string | null
  isNew: boolean
  newData: { nom: string; cognoms: string; club_id: string | null; email: string }
}

export default function NouCampionat() {
  const [step, setStep] = useState(1)
  const [temporades, setTemporades] = useState<Temporades[]>([])
  const [clubs, setClubs] = useState<{ id: string; nom: string }[]>([])
  const [allPlayers, setAllPlayers] = useState<Jugadors[]>([])
  const [formData, setFormData] = useState({
    temporada_id: '',
    nom: '',
    data: '',
    tipus_campionat: 'Classic',
    desempat: ['buchholz', 'median_buchholz', 'berger', 'differential', 'average_points']
  })
  const [matchesData, setMatchesData] = useState('')
  const [playerResolutions, setPlayerResolutions] = useState<PlayerResolution[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Load seasons, clubs and players
    Promise.all([
      supabase.from('temporades').select('*'),
      supabase.from('clubs').select('id, nom'),
      supabase.from('jugadors').select('*')
    ]).then(([tempRes, clubRes, playerRes]) => {
      if (tempRes.data) setTemporades(tempRes.data)
      if (clubRes.data) setClubs(clubRes.data)
      if (playerRes.data) setAllPlayers(playerRes.data)
    })
  }, [])

  const handleChampionshipSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStep(2)
  }

  const handleMatchesSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Parse CSV to get unique player names
    const parseResult = Papa.parse(matchesData, { header: true, skipEmptyLines: true })
    const uniqueNames = new Set<string>()
    parseResult.data.forEach((row: any) => {
      if (row.jugador_1) uniqueNames.add(row.jugador_1.trim())
      if (row.jugador_2) uniqueNames.add(row.jugador_2.trim())
    })

    // Create resolutions
    const resolutions: PlayerResolution[] = Array.from(uniqueNames).map(name => ({
      name,
      suggestions: findSimilarPlayers(name, allPlayers),
      selectedId: null,
      isNew: false,
      newData: { nom: '', cognoms: '', club_id: null, email: '' }
    }))

    setPlayerResolutions(resolutions)
    setStep(3)
    setLoading(false)
  }

  const handleResolutionChange = (index: number, selectedId: string | null, isNew: boolean) => {
    const updated = [...playerResolutions]
    updated[index].selectedId = selectedId
    updated[index].isNew = isNew
    if (isNew) {
      // Parse name into nom and cognoms
      const parts = updated[index].name.split(' ')
      updated[index].newData.nom = parts[0] || ''
      updated[index].newData.cognoms = parts.slice(1).join(' ') || ''
    }
    setPlayerResolutions(updated)
  }

  const handleNewPlayerDataChange = (index: number, field: string, value: string) => {
    const updated = [...playerResolutions]
    updated[index].newData = { ...updated[index].newData, [field]: value }
    setPlayerResolutions(updated)
  }

  const handleFinalSubmit = async () => {
    setLoading(true)

    try {
      // Create new players if any
      const newPlayers = playerResolutions.filter(r => r.isNew).map(r => ({
        nom: r.newData.nom,
        cognoms: r.newData.cognoms,
        club_id: r.newData.club_id,
        email: r.newData.email || null,
        es_soci: false
      }))

      let createdPlayers: Jugadors[] = []
      if (newPlayers.length > 0) {
        const { data, error } = await supabase.from('jugadors').insert(newPlayers).select()
        if (error) throw error
        createdPlayers = data || []
      }

      // Map names to IDs
      const nameToId = new Map<string, string>()
      playerResolutions.forEach((res) => {
        if (res.isNew) {
          const created = createdPlayers.find(p => p.nom === res.newData.nom && p.cognoms === res.newData.cognoms)
          if (created) nameToId.set(res.name, created.id)
        } else if (res.selectedId) {
          nameToId.set(res.name, res.selectedId)
        }
      })

      // Create championship
      const { data: campionat, error: campError } = await supabase
        .from('campionats')
        .insert([formData])
        .select()
        .single()

      if (campError) throw campError

      // Replace in CSV
      let csvWithIds = matchesData
      nameToId.forEach((id, name) => {
        csvWithIds = csvWithIds.replace(new RegExp(name, 'g'), id)
      })
      csvWithIds = csvWithIds.replace(/{campionat_id}/g, campionat.id)

      // Upload matches
      const formDataUpload = new FormData()
      const csvBlob = new Blob([csvWithIds], { type: 'text/csv' })
      formDataUpload.append('file', csvBlob, 'matches.csv')

      const response = await fetch('/api/upload-partides', {
        method: 'POST',
        body: formDataUpload
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error uploading matches')
      }

      alert('Campionat i partides creats correctament!')
      // Reset
      setStep(1)
      setFormData({
        temporada_id: '',
        nom: '',
        data: '',
        tipus_campionat: 'Classic',
        desempat: ['buchholz', 'median_buchholz', 'berger', 'differential', 'average_points']
      })
      setMatchesData('')
      setPlayerResolutions([])
    } catch (error) {
      console.error(error)
      alert('Error: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const allResolved = playerResolutions.every(r => r.selectedId || r.isNew)

  if (step === 1) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-6">Crear Nou Campionat</h1>
        <form onSubmit={handleChampionshipSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Temporada</label>
            <select
              value={formData.temporada_id}
              onChange={(e) => setFormData({...formData, temporada_id: e.target.value})}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              required
            >
              <option value="">Selecciona una temporada</option>
              {temporades.map(t => (
                <option key={t.id} value={t.id}>{t.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Nom del Campionat</label>
            <input
              type="text"
              value={formData.nom}
              onChange={(e) => setFormData({...formData, nom: e.target.value})}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Data</label>
            <input
              type="date"
              value={formData.data}
              onChange={(e) => setFormData({...formData, data: e.target.value})}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Tipus de Campionat</label>
            <select
              value={formData.tipus_campionat}
              onChange={(e) => setFormData({...formData, tipus_campionat: e.target.value})}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            >
              <option value="Classic">Classic</option>
              <option value="Duplicada">Duplicada</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Ordre de Desempat (separat per comes)</label>
            <input
              type="text"
              value={formData.desempat.join(', ')}
              onChange={(e) => setFormData({...formData, desempat: e.target.value.split(',').map(s => s.trim())})}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              placeholder="buchholz, median_buchholz, berger, differential, average_points"
            />
          </div>
          <button type="submit" className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600">
            Següent: Afegir Partides
          </button>
        </form>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-6">Afegir Partides al Campionat</h1>
        <form onSubmit={handleMatchesSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Dades de les Partides (CSV)</label>
            <textarea
              value={matchesData}
              onChange={(e) => setMatchesData(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 h-64"
              placeholder={`campionat_id,ronda,jugador_1,jugador_2,punts_1,punts_2,scrabbles_1,scrabbles_2,mot_1,mot_2,punts_mot_1,punts_mot_2,especial_1,especial_2,punts_especial_1,punts_especial_2
{campionat_id},1,"Joan Pérez","Maria García",350,280,2,1,SCRABBLE,,50,,BONUS,,30,`}
              required
            />
            <p className="text-sm text-gray-600 mt-1">
              Enganxa les dades CSV. Usa noms de jugadors (no IDs). El {`{campionat_id}`} es reemplaçarà automàticament.
            </p>
          </div>
          <div className="flex space-x-4">
            <button type="button" onClick={() => setStep(1)} className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600">
              Enrere
            </button>
            <button type="submit" disabled={loading} className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50">
              {loading ? 'Processant...' : 'Següent: Resoldre Jugadors'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // Step 3: Resolve players
  return (
    <div className="max-w-4xl mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-6">Resoldre Jugadors</h1>
      <div className="space-y-6">
        {playerResolutions.map((res, index) => (
          <div key={index} className="border border-gray-300 rounded-md p-4">
            <h3 className="font-semibold">Nom: {res.name}</h3>
            <div className="mt-2">
              <label className="block text-sm font-medium">Selecciona opció:</label>
              <select
                value={res.isNew ? 'new' : res.selectedId || ''}
                onChange={(e) => {
                  if (e.target.value === 'new') {
                    handleResolutionChange(index, null, true)
                  } else {
                    handleResolutionChange(index, e.target.value, false)
                  }
                }}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              >
                <option value="">Selecciona un jugador existent</option>
                {res.suggestions.map(s => (
                  <option key={s.player.id} value={s.player.id}>
                    {s.player.nom} {s.player.cognoms} (similitud: {(s.similarity * 100).toFixed(0)}%)
                  </option>
                ))}
                <option value="new">Crear jugador nou</option>
              </select>
            </div>
            {res.isNew && (
              <div className="mt-4 space-y-2">
                <input
                  type="text"
                  placeholder="Nom"
                  value={res.newData.nom}
                  onChange={(e) => handleNewPlayerDataChange(index, 'nom', e.target.value)}
                  className="block w-full border border-gray-300 rounded-md p-2"
                  required
                />
                <input
                  type="text"
                  placeholder="Cognoms"
                  value={res.newData.cognoms}
                  onChange={(e) => handleNewPlayerDataChange(index, 'cognoms', e.target.value)}
                  className="block w-full border border-gray-300 rounded-md p-2"
                  required
                />
                <select
                  value={res.newData.club_id || ''}
                  onChange={(e) => handleNewPlayerDataChange(index, 'club_id', e.target.value)}
                  className="block w-full border border-gray-300 rounded-md p-2"
                >
                  <option value="">Sense club</option>
                  {clubs.map(c => (
                    <option key={c.id} value={c.id}>{c.nom}</option>
                  ))}
                </select>
                <input
                  type="email"
                  placeholder="Email"
                  value={res.newData.email}
                  onChange={(e) => handleNewPlayerDataChange(index, 'email', e.target.value)}
                  className="block w-full border border-gray-300 rounded-md p-2"
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 flex space-x-4">
        <button type="button" onClick={() => setStep(2)} className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600">
          Enrere
        </button>
        <button
          onClick={handleFinalSubmit}
          disabled={!allResolved || loading}
          className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? 'Creant...' : 'Crear Campionat i Partides'}
        </button>
      </div>
    </div>
  )
}